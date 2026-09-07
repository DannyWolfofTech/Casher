#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'A Mac with Xcode and CocoaPods is required to validate iOS.' >&2
  exit 1
fi
command -v xcodebuild >/dev/null
command -v pod >/dev/null
npm ci
npm run build
# Package the ImageGen-produced opaque source at Apple's exact icon size.
sips -z 1024 1024 ios/assets/Casher-icon-source.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/Casher-1024.png >/dev/null
npx cap sync ios --deployment
git diff --exit-code -- ios/App/Podfile.lock
plutil -lint ios/App/App/Info.plist ios/App/App/App.entitlements ios/App/App/PrivacyInfo.xcprivacy
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .audit-results/ios-derived-data CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build
# A simulator-local signature supplies the default Keychain application identity.
# It uses no Apple account/certificate and is not valid for device distribution.
codesign --verify --deep --strict .audit-results/ios-derived-data/Build/Products/Release-iphonesimulator/App.app
codesign -dvv .audit-results/ios-derived-data/Build/Products/Release-iphonesimulator/App.app 2> .audit-results/ios-signature.txt
python3 -c 'from pathlib import Path; assert "Signature=adhoc" in Path(".audit-results/ios-signature.txt").read_text(), "Expected simulator-local signing only"'
codesign -d --entitlements :- .audit-results/ios-derived-data/Build/Products/Release-iphonesimulator/App.app
mkdir -p release-artifacts/ios
cp ios/App/Podfile.lock release-artifacts/ios/Podfile.lock
ditto .audit-results/ios-derived-data/Build/Products/Release-iphonesimulator/App.app release-artifacts/ios/Casher-Simulator.app
echo 'Built release-artifacts/ios/Casher-Simulator.app. Device distribution still requires owner signing and device validation.'
