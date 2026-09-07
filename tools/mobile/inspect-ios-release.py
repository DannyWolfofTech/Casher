"""Inspect the packaged simulator release without extracting binaries or printing configuration keys."""
import argparse
import hashlib
import json
import plistlib
import struct
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("archive", nargs="?", default="release-artifacts/ios/Casher-Simulator.zip")
parser.add_argument("--version", default="1.0.0")
parser.add_argument("--allow-unsigned", action="store_true", help="Inspect only the historical build that cannot use Keychain")
args = parser.parse_args()
archive = Path(args.archive)
with zipfile.ZipFile(archive) as bundle:
    root = "Casher-Simulator.app/"
    info = plistlib.loads(bundle.read(root + "Info.plist"))
    assert info["CFBundleIdentifier"] == "com.trycasher.app"
    assert info["CFBundleShortVersionString"] == args.version
    assert info["MinimumOSVersion"] == "15.0"
    assert info["CFBundleSupportedPlatforms"] == ["iPhoneSimulator"]
    config = json.loads(bundle.read(root + "capacitor.config.json"))
    assert config["appId"] == "com.trycasher.app"
    assert config["loggingBehavior"] == "none"
    assert config["server"].get("url") is None
    assert config["server"]["cleartext"] is False
    scripts = [name for name in bundle.namelist() if name.startswith(root + "public/assets/index-") and name.endswith(".js")]
    assert any(b"https://ewnjmvxildwmbdmosasz.supabase.co" in bundle.read(name) for name in scripts)
    executable = bundle.read(root + info["CFBundleExecutable"])
    assert executable[:4] == bytes.fromhex("cafebabe")
    count = struct.unpack(">I", executable[4:8])[0]
    architectures = {struct.unpack(">I", executable[8 + i * 20:12 + i * 20])[0] for i in range(count)}
    assert architectures == {0x1000007, 0x100000C}
    privacy = plistlib.loads(bundle.read(root + "PrivacyInfo.xcprivacy"))
    assert privacy["NSPrivacyTracking"] is False
    assert root + "embedded.mobileprovision" not in bundle.namelist()
    if not args.allow_unsigned:
        assert any(name.startswith(root + "_CodeSignature/") for name in bundle.namelist())

print(json.dumps({
    "bundleId": info["CFBundleIdentifier"],
    "version": info["CFBundleShortVersionString"],
    "minimumOS": info["MinimumOSVersion"],
    "architectures": ["arm64", "x86_64"],
    "productionApi": True,
    "distributionSigned": False,
    "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
}, indent=2))
