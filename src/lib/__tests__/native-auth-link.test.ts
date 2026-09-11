import { describe,expect,it } from 'vitest';
import { nativeAuthHandoff, parseNativeAuthLink } from '../native-auth-link';
describe('verified native auth callbacks',()=>{
  it('accepts only canonical HTTPS auth codes',()=>{
    expect(parseNativeAuthLink('https://trycasher.com/auth?code=pkce-code&mode=recovery')).toEqual({code:'pkce-code',recovery:true});
    expect(parseNativeAuthLink('https://trycasher.com/auth?error=access_denied')).toEqual({error:true});
  });
  it('hands a browser-held code back to the app without forwarding bearer tokens', () => {
    expect(nativeAuthHandoff('?code=one-use-code&mode=recovery')).toBe('com.trycasher.app:/auth?code=one-use-code&mode=recovery');
    expect(parseNativeAuthLink('com.trycasher.app:/auth?code=one-use-code&mode=recovery')).toEqual({ code: 'one-use-code', recovery: true });
    expect(nativeAuthHandoff('?code=x&access_token=secret')).toBeNull();
    expect(nativeAuthHandoff('?code=x', '#refresh_token=secret')).toBeNull();
    expect(nativeAuthHandoff('?code=x&code=y')).toBeNull();
    expect(nativeAuthHandoff('?code=x&redirect_to=https://evil.test')).toBeNull();
    expect(nativeAuthHandoff('?error=access_denied')).toBeNull();
  });
  it.each(['com.trycasher.app://evil.test/auth?code=x', 'com.trycasher.app:/dashboard?code=x', 'com.trycasher.app:/auth?code=x#access_token=y', 'com.trycasher.app:/auth?code=x&mode=recovery&mode=signin', 'com.trycasher.app:/auth?code=%0Ahello'])('rejects malformed app-return links: %s', value => expect(parseNativeAuthLink(value)).toBeNull());
  it.each(['https://trycasher.com.evil.test/auth?code=x','http://trycasher.com/auth?code=x','https://trycasher.com:8443/auth?code=x','https://evil@trycasher.com/auth?code=x','https://trycasher.com/auth?code=a&code=b','https://trycasher.com/auth#access_token=x','https://trycasher.com/auth?code=x#access_token=y','https://trycasher.com/dashboard?code=x','casher://auth?code=x'])('rejects untrusted or bearer-token callbacks: %s',value=>expect(parseNativeAuthLink(value)).toBeNull());
});
