import { mkdir, chmod } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Protect the directory before creating credential-bearing files inside it.
// POSIX file modes alone do not restrict inherited Windows permissions.
export async function privateDirectory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') return chmod(path, 0o700);
  const run = promisify(execFile);
  const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'], { windowsHide: true });
  const sid = stdout.trim();
  if (!/^S-1-5-(?:\d+-)*\d+$/.test(sid)) throw new Error('Cannot identify the credential directory owner');
  await run('icacls.exe', [path, '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F', '/inheritance:r'], { windowsHide: true });
}
