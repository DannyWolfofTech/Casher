param(
  [Parameter(Mandatory)][string]$ArchivePath,
  [Parameter(Mandatory)][string]$PrivateReportDirectory,
  [ValidatePattern('^casher-recovery-[a-z0-9-]+$')]
  [string]$ContainerName = ('casher-recovery-' + (Get-Date -Format 'yyyyMMddHHmmss'))
)
$ErrorActionPreference = 'Stop'
$archive = (Resolve-Path -LiteralPath $ArchivePath).Path
if (-not $archive.EndsWith('.backup')) { throw 'Pass the extracted PostgreSQL .backup archive.' }
$reportDirectory = [IO.Path]::GetFullPath($PrivateReportDirectory)
New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = Get-Acl -LiteralPath $reportDirectory
$acl.SetAccessRuleProtection($true, $false)
$acl.SetOwner($identity)
foreach ($sid in @($identity, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
}
Set-Acl -LiteralPath $reportDirectory -AclObject $acl

# Always create a new isolated instance; never accept a production host/connection URI.
& "$PSScriptRoot/start-isolated-restore.ps1" -ContainerName $ContainerName -ProviderExtensions
$watch = [Diagnostics.Stopwatch]::StartNew()
$report = [ordered]@{ startedAt=[DateTime]::UtcNow.ToString('o'); container=$ContainerName; archiveSha256=(Get-FileHash -LiteralPath $archive).Hash; restored=$false; behaviorVerified=$false }
try {
  # docker cp cannot populate this read-only rootfs. Stream bytes into its tmpfs
  # through docker exec, without placing the archive on a network or host mount.
  $info = [Diagnostics.ProcessStartInfo]::new('docker')
  foreach ($argument in @('exec','-i',$ContainerName,'sh','-c','cat > /tmp/source.backup')) { $info.ArgumentList.Add($argument) }
  $info.RedirectStandardInput=$true
  $info.UseShellExecute=$false
  $process=[Diagnostics.Process]::Start($info)
  $stream=[IO.File]::OpenRead($archive)
  try { $stream.CopyTo($process.StandardInput.BaseStream) } finally { $stream.Dispose(); $process.StandardInput.Close() }
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw 'Archive transfer failed.' }

  # Logical exports do not contain cluster roles. NOLOGIN keeps all identities
  # unusable for sign-in. Preserve ownership/ACLs; do not discard restore errors.
  $roles = @'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator NOLOGIN;
CREATE ROLE supabase_admin SUPERUSER NOLOGIN;
CREATE ROLE supabase_auth_admin NOLOGIN;
CREATE ROLE supabase_storage_admin NOLOGIN;
CREATE ROLE supabase_realtime_admin NOLOGIN;
CREATE ROLE supabase_functions_admin NOLOGIN;
CREATE ROLE pgbouncer NOLOGIN;
CREATE ROLE dashboard_user NOLOGIN;
CREATE ROLE sandbox_exec NOLOGIN;
'@
  $roles | & docker exec -i $ContainerName psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
  if ($LASTEXITCODE -ne 0) { throw 'Isolated role bootstrap failed.' }
  & docker exec $ContainerName pg_restore --list /tmp/source.backup > (Join-Path $reportDirectory 'archive-toc.txt')
  if ($LASTEXITCODE -ne 0) { throw 'Archive is unreadable.' }
  $toc = Get-Content -LiteralPath (Join-Path $reportDirectory 'archive-toc.txt') -Raw
  # This verified Lovable export omits the extension-managed live email queues,
  # but retains ACLs on their sequences. Bootstrap only those missing queues.
  $queueBootstrap = @()
  foreach ($queue in @('auth_emails','transactional_emails')) {
    if ($toc -notmatch " TABLE pgmq q_$queue ") { $queueBootstrap += "SELECT pgmq.create('$queue');" }
  }
  & docker exec $ContainerName pg_restore --file /tmp/restore.sql /tmp/source.backup
  if ($LASTEXITCODE -ne 0) { throw 'Archive SQL rendering failed.' }
  if ($queueBootstrap.Count) {
    $bootstrap = $queueBootstrap -join ' '
    $patch = "sed `"/^CREATE EXTENSION IF NOT EXISTS pgmq WITH SCHEMA pgmq;$/a $bootstrap`" /tmp/restore.sql > /tmp/restore-ready.sql"
    & docker exec $ContainerName sh -c $patch
  } else {
    & docker exec $ContainerName cp /tmp/restore.sql /tmp/restore-ready.sql
  }
  if ($LASTEXITCODE -ne 0) { throw 'Queue bootstrap preparation failed.' }
  & docker exec $ContainerName psql -X -q -v ON_ERROR_STOP=1 --single-transaction -U postgres -d postgres -f /tmp/restore-ready.sql > (Join-Path $reportDirectory 'restore.stdout.log') 2> (Join-Path $reportDirectory 'restore.stderr.log')
  if ($LASTEXITCODE -ne 0) { throw 'Restore failed. Inspect the private restore.stderr.log; no successful restore is claimed.' }
  $report.restored=$true
  $report.restoreSeconds=$watch.Elapsed.TotalSeconds
  Get-Content "$PSScriptRoot/recovery-baseline.sql" -Raw | & docker exec -i $ContainerName psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres > (Join-Path $reportDirectory 'restored-baseline.json')
  if ($LASTEXITCODE -ne 0) { throw 'Restored baseline query failed.' }
  Get-Content "$PSScriptRoot/verify-restored-database.sql" -Raw | & docker exec -i $ContainerName psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres > (Join-Path $reportDirectory 'behavior.stdout.log') 2> (Join-Path $reportDirectory 'behavior.stderr.log')
  if ($LASTEXITCODE -ne 0) { throw 'Restored behavior verification failed. Inspect private logs.' }
  $report.behaviorVerified=$true
  Get-Content "$PSScriptRoot/recovery-baseline.sql" -Raw | & docker exec -i $ContainerName psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres > (Join-Path $reportDirectory 'baseline-after-tests.json')
  if ($LASTEXITCODE -ne 0) { throw 'Post-test baseline query failed.' }
  Write-Output 'PASS provider export restored with ownership and ACLs; ownership, correction, entitlement and deletion checks passed.'
} finally {
  $watch.Stop()
  $report.elapsedSeconds=$watch.Elapsed.TotalSeconds
  $report.completedAt=[DateTime]::UtcNow.ToString('o')
  $report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $reportDirectory 'restore-result.json')
  # Removing this newly created isolated instance discards its memory-only copy.
  # The owner's original archive and private reports are retained.
  & docker rm --force $ContainerName | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Warning "Isolated copy needs cleanup: $ContainerName" }
}
