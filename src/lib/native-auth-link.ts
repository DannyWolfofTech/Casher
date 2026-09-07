export type NativeAuthLink = { code: string; recovery: boolean } | { error: true };
export function parseNativeAuthLink(value: string): NativeAuthLink | null {
  if (value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.host !== 'trycasher.com' || url.pathname !== '/auth' || url.username || url.password) return null;
    if (url.searchParams.has('error')) return { error: true };
    const code = url.searchParams.get('code');
    // Only PKCE codes are accepted; never install bearer tokens from an external link.
    if (!code || code.length > 2048 || url.searchParams.getAll('code').length !== 1 || url.hash) return null;
    return { code, recovery: url.searchParams.get('mode') === 'recovery' };
  } catch { return null; }
}
