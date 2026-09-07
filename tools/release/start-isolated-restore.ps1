param(
  [ValidatePattern('^casher-recovery-[a-z0-9-]+$')]
  [string]$ContainerName = ('casher-recovery-' + (Get-Date -Format 'yyyyMMddHHmmss'))
)
$ErrorActionPreference = 'Stop'
$image = 'public.ecr.aws/supabase/postgres:17.6.1.165'

# Use the already installed image: this step never downloads or provisions a service.
& docker image inspect $image --format '{{.Id}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'The reviewed PostgreSQL image is not installed.' }

# Memory-only data disappears when this disposable container stops. No TCP listener,
# published port, external network, credentials, cron worker or production mount exists.
$arguments = @(
  'run', '--detach', '--pull', 'never', '--name', $ContainerName,
  '--network', 'none', '--memory', '768m', '--cpus', '1', '--pids-limit', '128',
  '--read-only', '--user', '100:101', '--cap-drop', 'ALL',
  '--security-opt', 'no-new-privileges=true',
  '--tmpfs', '/tmp:rw,nosuid,size=67108864',
  '--tmpfs', '/var/run/postgresql:rw,nosuid,uid=100,gid=101,size=16777216',
  '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,uid=100,gid=101,size=536870912',
  '--entrypoint', '/bin/bash', $image, '-lc',
  "initdb -D /var/lib/postgresql/data --auth-local=trust --auth-host=reject >/tmp/initdb.log 2>&1 && exec postgres -D /var/lib/postgresql/data -c listen_addresses='' -c shared_preload_libraries='' -c unix_socket_directories='/var/run/postgresql'"
)
& docker @arguments | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not create the isolated restore target.' }

$ready = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  & docker exec $ContainerName pg_isready -q -h /var/run/postgresql -U postgres
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 1
}
if (-not $ready) { throw "Restore target did not become ready: $ContainerName" }

$isolation = & docker inspect $ContainerName --format '{{.HostConfig.NetworkMode}} {{json .HostConfig.PortBindings}} {{.HostConfig.ReadonlyRootfs}}'
if ($LASTEXITCODE -ne 0 -or $isolation.Trim() -ne 'none {} true') {
  throw 'Restore target isolation could not be verified.'
}
Write-Output "Prepared $ContainerName with no network, no published ports and temporary data storage."
Write-Output 'No production data has been restored. This preparation is not a completed recovery drill.'
