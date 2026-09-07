import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
let db:PGlite;
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key,email text);
    CREATE TABLE public.transactions(user_id uuid REFERENCES auth.users ON DELETE CASCADE);
    CREATE TABLE public.upload_history(user_id uuid);
    CREATE TABLE public.email_send_log(recipient_email text);
    CREATE TABLE public.email_unsubscribe_tokens(email text);
    CREATE SCHEMA pgmq;
    CREATE TABLE pgmq.q_auth_emails(message jsonb);
    INSERT INTO auth.users VALUES('${owner}','owner@example.test'),('${other}','other@example.test');
    INSERT INTO public.transactions VALUES('${owner}'),('${other}');
    INSERT INTO public.upload_history VALUES('${owner}'),('${other}');
    INSERT INTO public.email_send_log VALUES('owner@example.test'),('other@example.test');`);
  await db.exec(`INSERT INTO public.email_unsubscribe_tokens VALUES('owner@example.test'),('other@example.test');
    INSERT INTO pgmq.q_auth_emails VALUES('{"to":"owner@example.test"}'),('{"to":"other@example.test"}');`);
  await db.exec(readFileSync('supabase/migrations/20260907100000_account_lifecycle.sql','utf8'));
},30000);
afterAll(async()=>db?.close());
const acquire=(closing=false)=>db.query<{result:{code:string;lease:string}}>('select public.acquire_account_operation($1,$2) result',[owner,closing]).then(r=>r.rows[0].result);
describe('account closure database invariants',()=>{
  it('denies browser roles access to leases and deletion functions',async()=>{
    for(const role of ['anon','authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      try { await expect(acquire(true)).rejects.toThrow(); await expect(db.query('select * from app_private.account_operations')).rejects.toThrow(); await expect(db.query('select public.complete_account_deletion($1,$1,null)',[owner])).rejects.toThrow(); }
      finally {await db.exec('RESET ROLE');}
    }
  });
  it('serializes checkout/deletion, binds release, blocks new imports and deletes only the owner',async()=>{
    await db.exec('SET ROLE service_role');
    const checkout=await acquire(); expect(checkout.code).toBe('OK');
    expect((await acquire(true)).code).toBe('BUSY');
    await db.query('select public.release_account_operation($1,$2)',[owner,other]);
    expect((await acquire(true)).code).toBe('BUSY');
    await db.query('select public.release_account_operation($1,$2)',[owner,checkout.lease]);
    const deletion=await acquire(true); expect(deletion.code).toBe('OK');
    expect((await acquire()).code).toBe('CLOSING');
    await expect(db.query('select public.complete_account_deletion($1,$2,null)',[owner,other])).rejects.toThrow();
    await db.exec('RESET ROLE');
    await expect(db.query('insert into transactions values($1)',[owner])).rejects.toThrow(/deletion/);
    await db.exec('SET ROLE service_role');
    await db.query('select public.complete_account_deletion($1,$2,$3)',[owner,deletion.lease,'cus_removed']);
    expect((await db.query('select public.is_closed_billing_customer($1) closed',['cus_removed'])).rows[0]).toEqual({closed:true});
    await db.exec('RESET ROLE');
    expect((await db.query('select id from auth.users')).rows).toEqual([{id:other}]);
    expect((await db.query('select user_id from upload_history')).rows).toEqual([{user_id:other}]);
    expect((await db.query('select user_id from transactions')).rows).toEqual([{user_id:other}]);
    expect((await db.query('select recipient_email from email_send_log')).rows).toEqual([{recipient_email:'other@example.test'}]);
    expect((await db.query('select email from email_unsubscribe_tokens')).rows).toEqual([{email:'other@example.test'}]);
    expect((await db.query('select message from pgmq.q_auth_emails')).rows).toEqual([{message:{to:'other@example.test'}}]);
  });
});
