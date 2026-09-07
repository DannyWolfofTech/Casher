param([switch]$DeviceTests)
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$signingDir = Join-Path $workspace '.audit-results/android-signing'
$keystorePath = Join-Path $signingDir 'casher-release.p12'
$passwordPath = Join-Path $signingDir 'password.dpapi'
New-Item -ItemType Directory -Force -Path $signingDir | Out-Null
if (!(Test-Path -LiteralPath $keystorePath)) {
    if (Test-Path -LiteralPath $passwordPath) { throw 'A password exists without its signing key. Restore the key; do not silently replace it.' }
    $secretBytes = [byte[]]::new(48)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($secretBytes)
    $releasePassword = [Convert]::ToBase64String($secretBytes)
    $releasePassword | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $passwordPath
    $env:CASHER_ANDROID_STORE_PASSWORD = $releasePassword
    & "$env:JAVA_HOME/bin/keytool.exe" -genkeypair -alias casher-release -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Casher Android Release' -storetype PKCS12 -keystore $keystorePath -storepass:env CASHER_ANDROID_STORE_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Signing key creation failed.' }
}
if (!(Test-Path -LiteralPath $passwordPath)) { throw 'Restore the signing password from backup before building.' }
$secure = (Get-Content -LiteralPath $passwordPath -Raw).Trim() | ConvertTo-SecureString
$releasePassword = [System.Net.NetworkCredential]::new('', $secure).Password
$env:CASHER_ANDROID_KEYSTORE = $keystorePath
$env:CASHER_ANDROID_STORE_PASSWORD = $releasePassword
$env:CASHER_ANDROID_KEY_PASSWORD = $releasePassword
Push-Location $workspace
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    & npx.cmd cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'Native sync failed.' }
    Push-Location (Join-Path $workspace 'android')
    try {
        & ./gradlew.bat --no-daemon assembleRelease bundleRelease lintRelease testReleaseUnitTest
        if ($LASTEXITCODE -ne 0) { throw 'Android validation failed.' }
        if ($DeviceTests) {
            & ./gradlew.bat --no-daemon connectedReleaseAndroidTest
            if ($LASTEXITCODE -ne 0) { throw 'Signed release device tests failed.' }
        }
    } finally { Pop-Location }
    $artifacts = Join-Path $workspace 'release-artifacts/android'
    New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
    Copy-Item -LiteralPath 'android/app/build/outputs/apk/release/app-release.apk' -Destination (Join-Path $artifacts 'casher-1.0.0-release.apk')
    Copy-Item -LiteralPath 'android/app/build/outputs/bundle/release/app-release.aab' -Destination (Join-Path $artifacts 'casher-1.0.0-release.aab')
    Get-FileHash -Algorithm SHA256 (Join-Path $artifacts '*') | Format-Table
} finally {
    Pop-Location
    Remove-Item Env:CASHER_ANDROID_KEYSTORE, Env:CASHER_ANDROID_STORE_PASSWORD, Env:CASHER_ANDROID_KEY_PASSWORD -ErrorAction SilentlyContinue
    $releasePassword = $null
}
