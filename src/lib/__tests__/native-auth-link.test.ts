import { describe,expect,it } from 'vitest';
import { parseNativeAuthLink } from '../native-auth-link';
describe('verified native auth callbacks',()=>{
  it('accepts only canonical HTTPS auth codes',()=>{
    expect(parseNativeAuthLink('https://trycasher.com/auth?code=pkce-code&mode=recovery')).toEqual({code:'pkce-code',recovery:true});
    expect(parseNativeAuthLink('https://trycasher.com/auth?error=access_denied')).toEqual({error:true});
  });
  it.each(['https://trycasher.com.evil.test/auth?code=x','http://trycasher.com/auth?code=x','https://trycasher.com:8443/auth?code=x','https://evil@trycasher.com/auth?code=x','https://trycasher.com/auth?code=a&code=b','https://trycasher.com/auth#access_token=x','https://trycasher.com/auth?code=x#access_token=y','https://trycasher.com/dashboard?code=x','casher://auth?code=x'])('rejects untrusted or bearer-token callbacks: %s',value=>expect(parseNativeAuthLink(value)).toBeNull());
});
