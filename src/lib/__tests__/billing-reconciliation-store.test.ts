import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
let db:PGlite;
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const state={subscription_tier:'pro',subscription_status:'active',current_period_end:'2026-10-07T00:00:00Z'};
beforeAll(async()=>{
  db=new PGlite();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
  CREATE SCHEMA app_private;
  CREATE TABLE app_private.account_operations(user_id uuid,closing boolean);
  CREATE TABLE app_private.closed_billing_customers(customer_id text);
  CREATE TABLE profiles(user_id uuid PRIMARY KEY,stripe_customer_id text,subscription_tier text,subscription_status text,current_period_end timestamptz);
  INSERT INTO profiles VALUES('${owner}','cus_owner','free','inactive',NULL),('${other}','cus_other','free','inactive',NULL);`);
  await db.exec(readFileSync('supabase/migrations/20260907103000_billing_reconciliation.sql','utf8'));
},30000);
afterAll(async()=>db?.close());
const acquire=(customer='cus_owner')=>db.query<{lease:string|null}>('SELECT acquire_billing_sync($1) lease',[customer]).then(r=>r.rows[0].lease);
const commit=(lease:string,user=owner)=>db.query('SELECT commit_billing_sync($1,$2,$3,$4)', ['cus_owner',lease,user,JSON.stringify(state)]);
describe('Stripe reconciliation leases',()=>{
  it('rejects public access and serializes updates with an expiring fenced lease',async()=>{
    for(const role of ['anon','authenticated']) {
      await db.exec(`SET ROLE ${role}`);await expect(acquire()).rejects.toThrow();await db.exec('RESET ROLE');
    }
    const first=(await acquire())!;expect(await acquire()).toBeNull();
    await expect(commit(first,other)).rejects.toThrow(/profile/);
    await db.exec("UPDATE app_private.billing_sync SET lease_until=now()-interval '1 second'");
    const second=(await acquire())!;expect(second).not.toBe(first);
    await expect(commit(first)).rejects.toThrow(/lease/);
    await commit(second);
    expect((await db.query('SELECT subscription_tier FROM profiles WHERE user_id=$1',[owner])).rows[0]).toEqual({subscription_tier:'pro'});
    expect((await db.query('SELECT subscription_tier FROM profiles WHERE user_id=$1',[other])).rows[0]).toEqual({subscription_tier:'free'});
    await db.query('SELECT release_billing_sync($1,$2,false)',['cus_owner',second]);
  });
  it('skips closing accounts and recent successes; deleted billing identities cannot restore entitlements',async()=>{
    expect((await db.query('SELECT * FROM billing_reconciliation_candidates()')).rows).toEqual([{user_id:other,stripe_customer_id:'cus_other'}]);
    await db.query('INSERT INTO app_private.account_operations VALUES($1,true)',[other]);
    expect((await db.query('SELECT * FROM billing_reconciliation_candidates()')).rows).toEqual([]);
    await db.exec("INSERT INTO app_private.closed_billing_customers VALUES('cus_owner');UPDATE profiles SET subscription_tier='free'");
    const lease=(await acquire())!;await commit(lease);
    expect((await db.query('SELECT subscription_tier FROM profiles WHERE user_id=$1',[owner])).rows[0]).toEqual({subscription_tier:'free'});
  });
});
