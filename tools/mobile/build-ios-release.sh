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
npx cap sync ios
plutil -lint ios/App/App/Info.plist ios/App/App/App.entitlements ios/App/App/PrivacyInfo.xcprivacy
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .audit-results/ios-derived-data CODE_SIGNING_ALLOWED=NO build
mkdir -p release-artifacts/ios
ditto .audit-results/ios-derived-data/Build/Products/Release-iphonesimulator/App.app release-artifacts/ios/Casher-Simulator.app
echo 'Built release-artifacts/ios/Casher-Simulator.app. Device distribution still requires owner signing and device validation.'
