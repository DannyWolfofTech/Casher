param([string]$DeviceId = 'emulator-5554')
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$identity = Get-Content -LiteralPath (Join-Path $workspace '.audit-results/production-test-user.json') -Raw | ConvertFrom-Json
if ($identity.email -notmatch '^release-[a-f0-9-]{36}@example\.test$') { throw 'A disposable release account is required.' }
if ($DeviceId -notmatch '^emulator-\d+$') { throw 'This script only resets the dedicated emulator, never a personal device.' }
$avd = & "$env:ANDROID_HOME/platform-tools/adb.exe" -s $DeviceId emu avd name
if ($avd[0].Trim() -ne 'CasherRelease') { throw 'Expected the dedicated CasherRelease emulator.' }
& "$env:ANDROID_HOME/platform-tools/adb.exe" -s $DeviceId install -r (Join-Path $workspace 'release-artifacts/android/casher-1.0.0-release.apk') | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not install the signed release on the dedicated emulator.' }
& "$env:ANDROID_HOME/platform-tools/adb.exe" -s $DeviceId shell pm clear com.trycasher.app | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not reset the dedicated test app.' }
$secret = (Get-Content -LiteralPath (Join-Path $workspace '.audit-results/android-signing/password.dpapi') -Raw).Trim() | ConvertTo-SecureString
$env:CASHER_ANDROID_KEYSTORE = Join-Path $workspace '.audit-results/android-signing/casher-release.p12'
$env:CASHER_ANDROID_STORE_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
$env:CASHER_ANDROID_KEY_PASSWORD = $env:CASHER_ANDROID_STORE_PASSWORD
$env:ANDROID_SERIAL = $DeviceId
Push-Location (Join-Path $workspace 'android')
try {
  & ./gradlew.bat --no-daemon connectedReleaseAndroidTest '-Pandroid.testInstrumentationRunnerArguments.class=com.trycasher.app.ProductionSessionAcceptanceTest' ('-Pandroid.testInstrumentationRunnerArguments.acceptanceEmail=' + $identity.email) ('-Pandroid.testInstrumentationRunnerArguments.acceptancePassword=' + $identity.password)
  if ($LASTEXITCODE -ne 0) { throw 'Production session acceptance failed.' }
} finally {
  Pop-Location
  Remove-Item Env:CASHER_ANDROID_KEYSTORE,Env:CASHER_ANDROID_STORE_PASSWORD,Env:CASHER_ANDROID_KEY_PASSWORD,Env:ANDROID_SERIAL -ErrorAction SilentlyContinue
  $identity = $null
  $secret = $null
}
