$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$stripe = Join-Path $workspace '.audit-results/stripe-cli/stripe.exe'
if (!(Test-Path -LiteralPath $stripe)) { throw 'The verified Stripe CLI executable is missing.' }
$authDirectory = Join-Path $workspace '.audit-results/stripe-auth'
New-Item -ItemType Directory -Force -Path $authDirectory | Out-Null
$ownerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $authDirectory /grant:r "*$($ownerSid):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' /inheritance:r | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Stripe credential directory permissions could not be protected.' }
$config = Join-Path $authDirectory 'config.toml'
$stateFile = Join-Path $authDirectory 'authorization-state.json'
$common = @('--project-name','casher-launch','--device-name','Casher launch verification','--config',$config,'--color','off')
# Only the official CLI reads or writes its credential. Never inspect/export its config.
$requestOutput = & $stripe login --non-interactive @common 2>&1
if ($LASTEXITCODE -ne 0) { throw 'Stripe could not start browser authorization.' }
$requestText = $requestOutput -join "`n"
$jsonStart = $requestText.IndexOf('{')
$jsonEnd = $requestText.LastIndexOf('}')
if ($jsonStart -lt 0 -or $jsonEnd -le $jsonStart) { throw 'Stripe did not return a supported authorization request.' }
$request = $requestText.Substring($jsonStart,$jsonEnd-$jsonStart+1) | ConvertFrom-Json
if ($request.browser_url -ne 'https://access.stripe.com/stripecli/oauth2/device' -or $request.verification_code -notmatch '^[A-Z0-9]{4}-[A-Z0-9]{4}$' -or $request.next_step -ne 'stripe login --complete-device') {
    throw 'Stripe changed its authorization protocol; inspect the official CLI help before proceeding.'
}
$state = [ordered]@{startedAt=[DateTime]::UtcNow.ToString('o');status='awaiting_owner';browserUrl=$request.browser_url;verificationCode=$request.verification_code;expectedSandbox='acct_1SCrpvJMS012Ip2A'}
$state | ConvertTo-Json | Set-Content -LiteralPath $stateFile
Write-Output "Open $($request.browser_url)"
Write-Output "Pairing code: $($request.verification_code)"
Write-Output 'Approve Casher launch verification for the existing Casher sandbox. Do not copy a key or choose live mode.'
$completion = & $stripe login --complete-device @common 2>&1
$completionCode = $LASTEXITCODE
if ($completionCode -eq 0) {
    $state.status = 'authorized_pending_sandbox_identity_check'
    $state.Remove('verificationCode')
    $state | ConvertTo-Json | Set-Content -LiteralPath $stateFile
    Write-Output 'Stripe CLI authorization completed. The next step is verifying the sandbox account and test price, then running billing acceptance.'
} else {
    $state.status = $(if (($completion -join ' ') -match 'expired_token') { 'expired' } else { 'not_authorized' })
    $state.Remove('verificationCode')
    $state | ConvertTo-Json | Set-Content -LiteralPath $stateFile
    throw 'Stripe authorization did not complete. Run this script again when ready to approve a fresh code.'
}
