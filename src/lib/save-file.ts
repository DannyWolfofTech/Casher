import { isNativeApp } from './mobile-platform';

// Native downloads use the OS share sheet. Export files stay in the app cache,
// excluded from device backups, and are pruned on the next export or app launch.
export async function clearExpiredExports() {
  if (!isNativeApp()) return;
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  let files;
  try { files = (await Filesystem.readdir({ path: 'exports', directory: Directory.Cache })).files; }
  catch { return; } // A fresh installation has no export directory.
  await Promise.all(files.filter(file => file.type === 'file' && file.mtime < Date.now() - 60 * 60_000)
    .map(file => Filesystem.deleteFile({ path: `exports/${file.name}`, directory: Directory.Cache })));
}

export async function saveFile(contents: string, filename: string, mimeType: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) throw new Error('Invalid export filename');
  if (isNativeApp()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'), import('@capacitor/share'),
    ]);
    await clearExpiredExports();
    const file = await Filesystem.writeFile({ path: `exports/${filename}`, data: contents,
      directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true });
    await Share.share({ title: 'Casher data export', files: [file.uri], dialogTitle: 'Save or share your Casher export' });
    // Do not delete immediately: a selected app may still be reading the file.
    return;
  }
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
