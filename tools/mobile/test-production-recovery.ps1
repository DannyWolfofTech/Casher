param([ValidateSet('warm','cold-request','cold-complete')][string]$Phase='warm',[switch]$Build)
$ErrorActionPreference='Stop'
$workspace=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$adb=Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
$avd=& $adb -s emulator-5554 emu avd name
if ($avd[0].Trim() -ne 'CasherRelease') { throw 'Only the dedicated CasherRelease emulator is permitted.' }
$identity=Get-Content -LiteralPath (Join-Path $workspace '.audit-results/recovery-test-user.json') -Raw | ConvertFrom-Json
if ($identity.email -notmatch '^privacy\+release-[a-f0-9-]{36}@trycasher\.com$') { throw 'Disposable domain test identity required.' }
if ($Build) {
  $secret=(Get-Content -LiteralPath (Join-Path $workspace '.audit-results/android-signing/password.dpapi') -Raw).Trim() | ConvertTo-SecureString
  $env:CASHER_ANDROID_KEYSTORE=Join-Path $workspace '.audit-results/android-signing/casher-release.p12'
  $env:CASHER_ANDROID_STORE_PASSWORD=[System.Net.NetworkCredential]::new('', $secret).Password
  $env:CASHER_ANDROID_KEY_PASSWORD=$env:CASHER_ANDROID_STORE_PASSWORD
  Push-Location (Join-Path $workspace 'android')
  try {
    & ./gradlew.bat --no-daemon assembleReleaseAndroidTest
    if ($LASTEXITCODE -ne 0) { throw 'Recovery instrumentation did not compile.' }
  } finally {
    Pop-Location
    Remove-Item Env:CASHER_ANDROID_KEYSTORE,Env:CASHER_ANDROID_STORE_PASSWORD,Env:CASHER_ANDROID_KEY_PASSWORD -ErrorAction SilentlyContinue
  }
  & $adb -s emulator-5554 install -r (Join-Path $workspace 'release-artifacts/android/casher-1.0.0-release.apk') | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Release installation failed.' }
  & $adb -s emulator-5554 install -r (Join-Path $workspace 'android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk') | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Test installation failed.' }
  & $adb -s emulator-5554 shell pm clear com.trycasher.app | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Dedicated test reset failed.' }
}
$oldPassword=if($Phase -eq 'warm'){$identity.password}else{$identity.newPassword}
$newPassword=if($Phase -eq 'warm'){$identity.newPassword}else{$identity.coldPassword}
$runnerArgs=@('-s','emulator-5554','shell','am','instrument','-w','-r','-e','class','com.trycasher.app.ProductionRecoveryAcceptanceTest#recoverThroughActualEmailAndNativePkce','-e','recoveryPhase',$Phase,'-e','acceptanceEmail',$identity.email,'-e','acceptancePassword',$oldPassword,'-e','newPassword',$newPassword)
if ($Phase -eq 'cold-complete') {
  $callback=(Get-Content -LiteralPath (Join-Path $workspace '.audit-results/recovery-callback.json') -Raw | ConvertFrom-Json).url
  if ($callback -notmatch '^https://trycasher\.com/auth\?') { throw 'Unexpected callback origin.' }
  & $adb -s emulator-5554 shell am force-stop com.trycasher.app
  $runnerArgs+=@('-e','callbackUrl',("'"+$callback.Replace("'","'\''")+"'"))
}
$runnerArgs+='com.trycasher.app.test/androidx.test.runner.AndroidJUnitRunner'
$output=& $adb @runnerArgs 2>&1
$output | ForEach-Object { Write-Output $_ }
if ($LASTEXITCODE -ne 0 -or ($output -join "`n") -notmatch 'OK \(1 test\)') { throw 'Production recovery acceptance failed.' }
$identity=$null;$oldPassword=$null;$newPassword=$null;$runnerArgs=$null
