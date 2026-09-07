import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
describe('operational retention and deletion recovery',()=>{
  it('denies browser cleanup, records deletions without email, and preserves current records',async()=>{
    const db=new PGlite();
    try {
      await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA app_private;CREATE SCHEMA auth;CREATE SCHEMA pgmq;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
      CREATE TABLE profiles(stripe_customer_id text);
      CREATE TABLE webhook_events(created_at timestamptz);
      CREATE TABLE email_send_log(created_at timestamptz);
      CREATE TABLE app_private.billing_sync(customer_id text,last_success timestamptz,last_failure timestamptz,lease_until timestamptz);
      CREATE TABLE app_private.closed_billing_customers(closed_at timestamptz);
      CREATE TABLE pgmq.q_auth_emails(enqueued_at timestamptz,message jsonb);
      INSERT INTO webhook_events VALUES(now()),(now()-interval '91 days');
      INSERT INTO email_send_log VALUES(now()),(now()-interval '31 days');
      INSERT INTO pgmq.q_auth_emails VALUES(now(),'{"to":"current@example.test"}'),(now()-interval '2 days','{"to":"old@example.test"}');
      INSERT INTO auth.users VALUES('00000000-0000-4000-8000-000000000001','deleted@example.test');`);
      await db.exec(readFileSync('supabase/migrations/20260907110000_operational_retention.sql','utf8'));
      for(const role of ['anon','authenticated']) {
        await db.exec(`SET ROLE ${role}`);
        await expect(db.query('SELECT purge_operational_data()')).rejects.toThrow();
        await expect(db.query('SELECT * FROM app_private.closed_accounts')).rejects.toThrow();
        await db.exec('RESET ROLE');
      }
      await db.exec('DELETE FROM auth.users;SET ROLE service_role;SELECT purge_operational_data();RESET ROLE;');
      for(const table of ['webhook_events','email_send_log','pgmq.q_auth_emails','app_private.closed_accounts']) {
        expect((await db.query(`SELECT count(*)::int n FROM ${table}`)).rows).toEqual([{n:1}]);
      }
      const receipt=(await db.query('SELECT * FROM app_private.closed_accounts')).rows[0];
      expect(Object.keys(receipt)).toEqual(['user_id','closed_at']);
      expect(JSON.stringify(receipt)).not.toContain('@');
    } finally {await db.close();}
  },30000);
});
