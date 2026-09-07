#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
[[ "$(uname -s)" == Darwin ]] || { echo 'macOS is required.' >&2; exit 1; }
ruby tools/mobile/configure-ios-ui-tests.rb
xcrun simctl list devices available -j > .audit-results/ios-simulators.json
simulator_id=$(node -e 'const fs=require("fs");const all=JSON.parse(fs.readFileSync(".audit-results/ios-simulators.json","utf8")).devices;const device=Object.entries(all).filter(([runtime])=>runtime.includes("iOS")).reverse().flatMap(([,devices])=>devices).find(device=>device.isAvailable&&device.name.startsWith("iPhone"));if(!device)throw Error("No installed iPhone simulator");process.stdout.write(device.udid);')
test_status=0
xcodebuild -workspace ios/App/App.xcworkspace -scheme CasherAcceptance -configuration Release \
  -destination "platform=iOS Simulator,id=$simulator_id" \
  -derivedDataPath .audit-results/ios-derived-data -resultBundlePath .audit-results/ios-acceptance.xcresult \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- test || test_status=$?
mkdir -p release-artifacts/ios/screenshots
if [[ -d .audit-results/ios-acceptance.xcresult ]]; then
  xcrun xcresulttool export attachments --path .audit-results/ios-acceptance.xcresult --output-path release-artifacts/ios/screenshots
fi
exit "$test_status"
