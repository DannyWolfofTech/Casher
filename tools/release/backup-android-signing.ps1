param(
    [string]$DestinationDirectory = (Join-Path $env:LOCALAPPDATA 'Casher/SigningBackups'),
    [switch]$Portable
)
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$source = Join-Path $workspace '.audit-results/android-signing'
$keyPath = Join-Path $source 'casher-release.p12'
$passwordPath = Join-Path $source 'password.dpapi'
$expectedCertificate = '84121F7D5C87F1C490ED3C7422DAEF8FE1CB634AE9D14FD03B52B96BC317D4B4'
if (!(Test-Path -LiteralPath $keyPath) -or !(Test-Path -LiteralPath $passwordPath)) {
    throw 'Original signing material is missing. Restore it; never generate a replacement key.'
}
$destinationRoot = [IO.Path]::GetFullPath($DestinationDirectory)
if ($destinationRoot.StartsWith($workspace + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Choose a backup destination outside the repository.'
}
$backup = Join-Path $destinationRoot ('Signing-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$ownerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $backup /grant:r "*$($ownerSid):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' /inheritance:r | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Backup filesystem cannot enforce private access permissions.' }
$certificate = $null
$verified = $null
$originalPassword = $null
$exportPassword = $null
try {
    $secureOriginal = (Get-Content -LiteralPath $passwordPath -Raw).Trim() | ConvertTo-SecureString
    $originalPassword = [Net.NetworkCredential]::new('', $secureOriginal).Password
    $flags = [Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet -bor [Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable
    $certificate = [Security.Cryptography.X509Certificates.X509CertificateLoader]::LoadPkcs12FromFile($keyPath, $originalPassword, $flags, $null)
    if (!$certificate.HasPrivateKey -or $certificate.GetCertHashString([Security.Cryptography.HashAlgorithmName]::SHA256) -ne $expectedCertificate) {
        throw 'The source key does not match the delivered Android release certificate.'
    }
    $outputKey = Join-Path $backup 'casher-release.p12'
    if ($Portable) {
        $chosen = Read-Host 'Choose a new backup password (20+ characters; save it in your password manager)' -AsSecureString
        $confirm = Read-Host 'Confirm the backup password' -AsSecureString
        $exportPassword = [Net.NetworkCredential]::new('', $chosen).Password
        $confirmation = [Net.NetworkCredential]::new('', $confirm).Password
        if ($exportPassword.Length -lt 20 -or $exportPassword -cne $confirmation) { throw 'Passwords must match and contain at least 20 characters.' }
        $pbe = [Security.Cryptography.PbeParameters]::new([Security.Cryptography.PbeEncryptionAlgorithm]::Aes256Cbc, [Security.Cryptography.HashAlgorithmName]::SHA256, 200000)
        [IO.File]::WriteAllBytes($outputKey, $certificate.ExportPkcs12($pbe, $exportPassword))
    } else {
        Copy-Item -LiteralPath $keyPath -Destination $outputKey
        Copy-Item -LiteralPath $passwordPath -Destination (Join-Path $backup 'password.dpapi')
        foreach ($name in @('casher-release.p12','password.dpapi')) {
            if ((Get-FileHash -LiteralPath (Join-Path $source $name)).Hash -ne (Get-FileHash -LiteralPath (Join-Path $backup $name)).Hash) { throw 'Backup bytes differ from the source.' }
        }
        $exportPassword = $originalPassword
    }
    $verified = [Security.Cryptography.X509Certificates.X509CertificateLoader]::LoadPkcs12FromFile($outputKey, $exportPassword, [Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet, $null)
    if (!$verified.HasPrivateKey -or $verified.GetCertHashString([Security.Cryptography.HashAlgorithmName]::SHA256) -ne $expectedCertificate) { throw 'Backup private-key/certificate verification failed.' }
    $manifest = [ordered]@{
        createdAt = [DateTime]::UtcNow.ToString('o')
        applicationId = 'com.trycasher.app'
        certificateSha256 = $expectedCertificate
        keyFileSha256 = (Get-FileHash -LiteralPath $outputKey -Algorithm SHA256).Hash
        privateKeyReopened = $true
        portable = [bool]$Portable
        recoveryRequirement = $(if ($Portable) { 'Keep this encrypted PKCS12 and its chosen password in separate recoverable owner-controlled storage.' } else { 'Requires the original Windows user/machine DPAPI context. This protects against accidental deletion, not machine loss. Create a portable backup separately.' })
    }
    $manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backup 'manifest.json')
    Write-Output "Verified signing backup: $backup"
    Write-Output $manifest.recoveryRequirement
} finally {
    if ($verified) { $verified.Dispose() }
    if ($certificate) { $certificate.Dispose() }
    $originalPassword = $null; $exportPassword = $null; $confirmation = $null
    if ($secureOriginal) { $secureOriginal.Dispose() }
    if ($chosen) { $chosen.Dispose() }
    if ($confirm) { $confirm.Dispose() }
}
