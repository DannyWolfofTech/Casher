import { beforeEach, expect, it, vi } from 'vitest';
const share = vi.hoisted(() => vi.fn());
vi.mock('../mobile-platform', () => ({ isNativeApp: () => true }));
vi.mock('@capacitor/share', () => ({ Share: { share } }));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' }, Encoding: { UTF8: 'utf8' },
  Filesystem: { readdir: async () => ({ files: [] }), writeFile: async () => ({ uri: 'file:///private/cache/export.json' }) },
}));
import { saveFile } from '../save-file';
beforeEach(() => { share.mockReset(); });
it('treats dismissing the iOS share sheet as a normal outcome', async () => {
  share.mockRejectedValue(new Error('Share canceled'));
  await expect(saveFile('{}', 'export.json', 'application/json')).resolves.toBeUndefined();
});
it('still reports a real sharing failure', async () => {
  share.mockRejectedValue(new Error('Unable to share file'));
  await expect(saveFile('{}', 'export.json', 'application/json')).rejects.toThrow('Unable to share file');
});
