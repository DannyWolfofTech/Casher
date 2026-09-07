import { describe, expect, it, vi } from 'vitest';
import { secureSessionAdapter, sessionStorageForPlatform } from '../auth-storage';
describe('secure native session adapter',()=>{
  it('persists and removes sessions through the asynchronous OS adapter',async()=>{
    const values=new Map<string,string>();
    const native={getItem:async(key:string)=>values.get(key)??null,setItem:async(key:string,value:string)=>{values.set(key,value);},removeItem:async(key:string)=>{values.delete(key);}};
    const loader=vi.fn(async()=>native);
    const store=secureSessionAdapter(loader);
    await store.setItem('session','refresh-token');
    expect(await secureSessionAdapter(async()=>native).getItem('session')).toBe('refresh-token');
    await store.removeItem('session');
    expect(await store.getItem('session')).toBeNull();
    expect(loader).toHaveBeenCalledTimes(1);
  });
  it('propagates secure storage failures and retries initialization without a plaintext fallback',async()=>{
    const loader=vi.fn(async()=>{throw new Error('Device locked');});
    const store=secureSessionAdapter(loader);
    await expect(store.setItem('session','secret')).rejects.toThrow('Device locked');
    await expect(store.getItem('session')).rejects.toThrow('Device locked');
    expect(loader).toHaveBeenCalledTimes(2);
  });
  it('preserves the web adapter',()=>{
    const web={}; expect(sessionStorageForPlatform(false,()=>web)).toBe(web);
  });
});
