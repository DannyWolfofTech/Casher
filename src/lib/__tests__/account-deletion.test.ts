import { describe, expect, it, vi } from 'vitest';
import { deleteAccount, verifyDeletionRequest } from '../../../supabase/functions/_shared/account-deletion';

describe('account deletion orchestration', () => {
  const now = Date.now();
  it('requires exact confirmation and a recent verified sign-in', () => {
    expect(()=>verifyDeletionRequest({confirmation:'DELETE'},new Date(now-1000).toISOString(),now)).not.toThrow();
    for(const body of [{confirmation:'delete'},{confirmation:'DELETE',userId:'victim'},null,[]]) expect(()=>verifyDeletionRequest(body,new Date(now).toISOString(),now)).toThrow();
    for(const time of [undefined,'invalid',new Date(now-600001).toISOString(),new Date(now+60000).toISOString()]) expect(()=>verifyDeletionRequest({confirmation:'DELETE'},time,now)).toThrow(/Sign in again/);
  });
  function setup() {
    const calls:string[]=[];
    const step=(name:string)=>vi.fn(async()=>{calls.push(name);});
    return {calls,store:{acquire:vi.fn(async()=>({code:'OK',lease:'lease'})),customer:vi.fn(async():Promise<string|null>=>'cus_owned'),complete:step('delete'),release:step('release')},billing:{verifyCustomer:step('verify'),expireCheckouts:step('expire'),cancelSubscriptions:step('cancel')}};
  }
  it('stops future charges before deleting data and releases the lease',async()=>{
    const s=setup(); await deleteAccount('owner',s.store,s.billing);
    expect(s.calls).toEqual(['verify','expire','cancel','delete','release']);
    expect(s.store.complete).toHaveBeenCalledWith('owner','lease','cus_owned');
  });
  it('allows free-account deletion without Stripe availability',async()=>{
    const s=setup(); s.store.customer.mockResolvedValue(null); await deleteAccount('owner',s.store,s.billing);
    expect(s.calls).toEqual(['delete','release']);
  });
  it('preserves data and allows retry after each provider failure',async()=>{
    for(const step of ['verifyCustomer','expireCheckouts','cancelSubscriptions'] as const) {
      const s=setup(); s.billing[step].mockRejectedValueOnce(new Error('Provider unavailable'));
      await expect(deleteAccount('owner',s.store,s.billing)).rejects.toThrow();
      expect(s.store.complete).not.toHaveBeenCalled(); expect(s.store.release).toHaveBeenCalled();
      await deleteAccount('owner',s.store,s.billing);
      expect(s.store.complete).toHaveBeenCalledTimes(1);
    }
  });
  it('does not mutate Stripe or data when checkout holds the account lease',async()=>{
    const s=setup(); s.store.acquire.mockResolvedValue({code:'BUSY',lease:''});
    await expect(deleteAccount('owner',s.store,s.billing)).rejects.toThrow(/progress/);
    expect(s.calls).toEqual([]);
    expect(s.store.customer).not.toHaveBeenCalled();
  });
  it('resolves a customer created by checkout only after the deletion lease is acquired',async()=>{
    const s=setup(); let bound:string|null=null;
    s.store.acquire.mockImplementation(async()=>{bound='cus_new';return {code:'OK',lease:'lease'};});
    s.store.customer.mockImplementation(async()=>bound);
    await deleteAccount('owner',s.store,s.billing);
    expect(s.billing.verifyCustomer).toHaveBeenCalledWith('owner','cus_new');
    expect(s.store.complete).toHaveBeenCalledWith('owner','lease','cus_new');
  });
});
