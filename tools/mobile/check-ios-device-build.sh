#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
[[ "$(uname -s)" == Darwin ]] || { echo 'Run on a Mac with Xcode after build-ios-release.sh.' >&2; exit 1; }
# Compile against the actual iPhone SDK before owner signing. No provisioning,
# Apple account changes, distribution claims or agreement acceptance occur here.
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath .audit-results/ios-device-derived CODE_SIGNING_ALLOWED=NO build
mkdir -p release-artifacts/ios
ditto .audit-results/ios-device-derived/Build/Products/Release-iphoneos/App.app release-artifacts/ios/Casher-Device-Unsigned.app
ditto -c -k --sequesterRsrc --keepParent release-artifacts/ios/Casher-Device-Unsigned.app release-artifacts/ios/Casher-Device-Unsigned.zip
python3 tools/mobile/inspect-ios-release.py release-artifacts/ios/Casher-Device-Unsigned.zip --platform device --allow-unsigned
echo 'Device Release compilation passed. This unsigned archive cannot be installed or submitted; owner signing and device acceptance are still required.'
