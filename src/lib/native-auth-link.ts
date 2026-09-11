import { isAuthRetryableFetchError } from '@supabase/supabase-js';

export type NativeAuthLink = { code: string; recovery: boolean } | { error: true };

export function nativeAuthFailurePath(error: unknown): string {
  // The SDK removes the PKCE verifier after a failed exchange, including a
  // network failure. Ask for a fresh link; do not replay or restore credentials.
  return isAuthRetryableFetchError(error) ? '/auth?error=connection' : '/auth?error=callback';
}

export function parseNativeAuthLink(value: string): NativeAuthLink | null {
  if (value.length > 4096) return null;
  try {
    const url = new URL(value);
    const verifiedWebLink = url.protocol === 'https:' && url.host === 'trycasher.com';
    const appReturnLink = url.protocol === 'com.trycasher.app:' && !url.host;
    if ((!verifiedWebLink && !appReturnLink) || url.pathname !== '/auth' || url.username || url.password || url.hash) return null;
    if ([...url.searchParams.keys()].some(key => !['code', 'mode', 'error', 'error_code', 'error_description'].includes(key))) return null;
    if (url.searchParams.has('error')) return { error: true };
    const code = url.searchParams.get('code');
    // Only PKCE codes are accepted; never install bearer tokens from an external link.
    if (!code || !/^[A-Za-z0-9_-]{1,2048}$/.test(code) || url.searchParams.getAll('code').length !== 1 || url.searchParams.getAll('mode').length > 1) return null;
    return { code, recovery: url.searchParams.get('mode') === 'recovery' };
  } catch { return null; }
}

// Only native clients initiate PKCE in Casher. If an email's HTTP redirect
// stays in a browser, hand the one-use code back to the initiating app. It
// still needs the verifier in that device's Keychain; never forward tokens.
export function nativeAuthHandoff(search: string, hash = ''): string | null {
  const link = parseNativeAuthLink(`https://trycasher.com/auth${search}${hash}`);
  if (!link || 'error' in link) return null;
  return `com.trycasher.app:/auth?code=${encodeURIComponent(link.code)}${link.recovery ? '&mode=recovery' : ''}`;
}
