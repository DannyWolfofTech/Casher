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
parser.add_argument("--platform", choices=["simulator", "device"], default="simulator")
parser.add_argument("--allow-unsigned", action="store_true", help="Inspect a compilation-only build; it is not accepted for device authentication")
args = parser.parse_args()
archive = Path(args.archive)
with zipfile.ZipFile(archive) as bundle:
    root = "Casher-Simulator.app/" if args.platform == "simulator" else "Casher-Device-Unsigned.app/"
    info = plistlib.loads(bundle.read(root + "Info.plist"))
    assert info["CFBundleIdentifier"] == "com.trycasher.app"
    assert info["CFBundleShortVersionString"] == args.version
    assert info["MinimumOSVersion"] == "15.0"
    assert info["CFBundleSupportedPlatforms"] == ["iPhoneSimulator" if args.platform == "simulator" else "iPhoneOS"]
    if args.platform == "device":
        assert args.allow_unsigned, "This device artifact is compilation evidence only; explicitly acknowledge its unsigned status"
    config = json.loads(bundle.read(root + "capacitor.config.json"))
    assert config["appId"] == "com.trycasher.app"
    assert config["loggingBehavior"] == "none"
    assert config["server"].get("url") is None
    assert config["server"]["cleartext"] is False
    scripts = [name for name in bundle.namelist() if name.startswith(root + "public/assets/index-") and name.endswith(".js")]
    assert any(b"https://ewnjmvxildwmbdmosasz.supabase.co" in bundle.read(name) for name in scripts)
    executable = bundle.read(root + info["CFBundleExecutable"])
    if args.platform == "simulator":
        assert executable[:4] == bytes.fromhex("cafebabe")
        count = struct.unpack(">I", executable[4:8])[0]
        architectures = {struct.unpack(">I", executable[8 + i * 20:12 + i * 20])[0] for i in range(count)}
        assert architectures == {0x1000007, 0x100000C}
    else:
        assert executable[:4] == bytes.fromhex("cffaedfe"), "Expected a 64-bit device Mach-O executable"
        assert struct.unpack("<I", executable[4:8])[0] == 0x100000C, "Expected arm64 device architecture"
    privacy = plistlib.loads(bundle.read(root + "PrivacyInfo.xcprivacy"))
    assert privacy["NSPrivacyTracking"] is False
    assert root + "embedded.mobileprovision" not in bundle.namelist()
    if not args.allow_unsigned:
        assert any(name.startswith(root + "_CodeSignature/") for name in bundle.namelist())

print(json.dumps({
    "bundleId": info["CFBundleIdentifier"],
    "version": info["CFBundleShortVersionString"],
    "minimumOS": info["MinimumOSVersion"],
    "platform": args.platform,
    "architectures": ["arm64", "x86_64"] if args.platform == "simulator" else ["arm64"],
    "productionApi": True,
    "distributionSigned": False,
    "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
}, indent=2))
