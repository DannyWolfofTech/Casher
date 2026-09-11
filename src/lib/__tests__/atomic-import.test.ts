import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';

let db: PGlite;
const uid = '00000000-0000-4000-8000-000000000001';
const row = (id: number) => ({ date: '2026-09-02', description: 'Netflix ' + id, amount: -12, direction: 'debit', category: 'Subscription', isSubscription: true, merchant: 'Netflix' });
const sub = { service_name: 'Netflix', amount: 12, frequency: 'monthly', last_charged: '2026-09-02', estimated_annual_cost: 144 };
const run = (rows = [row(1)], hash = 'a'.repeat(64)) => db.query<{ result: Record<string, unknown> }>('SELECT public.import_statement_atomic($1, $2, $3::jsonb, $4::jsonb) AS result', [uid, hash, JSON.stringify(rows), JSON.stringify([sub])]).then(result => result.rows[0].result);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, last_sign_in_at timestamptz default now());
    INSERT INTO auth.users(id) VALUES ('${uid}'), ('00000000-0000-4000-8000-000000000002');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE FUNCTION public.current_request_role() RETURNS text LANGUAGE sql AS $$ SELECT coalesce(current_setting('request.jwt.claim.role', true), '') $$;
    CREATE TABLE public.profiles(user_id uuid primary key, subscription_tier text default 'free', monthly_uploads_used integer default 0, uploads_reset_date date, stripe_customer_id text, subscription_status text, current_period_end timestamptz);
    CREATE TABLE public.transactions(id uuid default gen_random_uuid(), user_id uuid, date date not null, description text not null, amount numeric(10,2) not null, direction text, import_version integer, category text, is_recurring boolean, recurring_frequency text, merchant text);
    CREATE TABLE public.detected_subscriptions(id uuid default gen_random_uuid(), user_id uuid, service_name text, amount numeric(10,2), frequency text, last_charged date, estimated_annual_cost numeric(10,2), status text);
    CREATE TABLE public.upload_history(id uuid default gen_random_uuid(), user_id uuid, csv_hash text, total_spending numeric, total_credits numeric, subscriptions_count integer, potential_savings numeric, transaction_count integer);
    CREATE TABLE public.savings_goals(title text, target_amount numeric, current_amount numeric);
    ALTER TABLE profiles ADD COLUMN monthly_spending_history jsonb default '[]';
    CREATE SCHEMA app_private;
    CREATE TABLE app_private.account_operations(user_id uuid primary key, closing boolean default false);
  `);
  const quota = readFileSync('supabase/migrations/20260904131024_b8b43d04-c9b0-4de6-be86-89d1894dd792.sql', 'utf8');
  await db.exec(quota.slice(0, quota.indexOf('DO $$')));
  await db.exec(quota.slice(quota.indexOf('CREATE OR REPLACE FUNCTION public.upload_limit_for_tier'), quota.indexOf('-- Signed cash-flow columns')));
  await db.exec(readFileSync('supabase/migrations/20260904220000_atomic_statement_import.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20260904230000_statement_corrections.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20260906220000_review_conflict_status.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20260911140000_clear_statement_data.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20260911150000_statement_reset_recovery.sql', 'utf8'));
  await db.exec(`ALTER TABLE transactions ENABLE ROW LEVEL SECURITY; ALTER TABLE detected_subscriptions ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, UPDATE ON transactions, detected_subscriptions TO authenticated;
    CREATE POLICY own_transactions ON transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
    CREATE POLICY own_subscriptions ON detected_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());`);
}, 30000);
beforeEach(async () => {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.role', 'service_role', false);
    SELECT set_config('request.jwt.claim.sub', '${uid}', false);
    TRUNCATE public.profiles, public.transactions, public.detected_subscriptions, public.upload_history, public.statement_reviews, public.savings_goals, app_private.statement_reset_receipts, app_private.account_operations;
    UPDATE auth.users SET last_sign_in_at=now();
    INSERT INTO profiles(user_id, uploads_reset_date) VALUES ('${uid}', date_trunc('month', now())::date);
    SELECT set_config('request.jwt.claim.role', 'service_role', false);`);
});
afterAll(async () => { await db?.close(); });
describe('real PostgreSQL atomic import', () => {
  it('preserves repeated purchases and reconciles their counts across overlapping files', async () => {
    await db.exec("UPDATE profiles SET subscription_tier = 'pro'");
    expect(await run([row(1), row(1)])).toMatchObject({ transactionsCount: 2, batchSpending: 24 });
    expect(await run([row(1), row(1)], 'b'.repeat(64))).toMatchObject({ code: 'REPLAY' });
    expect(await run([row(1), row(1), row(1)], 'c'.repeat(64))).toMatchObject({ transactionsCount: 1, duplicatesSkipped: 2 });
    expect((await db.query('SELECT count(*)::int AS count FROM transactions')).rows[0]).toEqual({ count: 3 });
  });
  it('commits all related records and charges quota once; repeat upload is idempotent', async () => {
    expect(await run()).toMatchObject({ code: 'OK', transactionsCount: 1, batchSpending: 12 });
    expect(await run()).toMatchObject({ code: 'REPLAY', transactionsCount: 0 });
    expect((await db.query('SELECT monthly_uploads_used FROM profiles')).rows[0]).toEqual({ monthly_uploads_used: 1 });
    expect((await db.query('SELECT count(*)::int AS count FROM upload_history')).rows[0]).toEqual({ count: 1 });
  });
  it('rolls back an earlier insert and the quota when a later transaction fails', async () => {
    await expect(run([row(1), { ...row(2), amount: -100000000 }])).rejects.toThrow();
    expect((await db.query('SELECT count(*)::int AS count FROM transactions')).rows[0]).toEqual({ count: 0 });
    expect((await db.query('SELECT monthly_uploads_used FROM profiles')).rows[0]).toEqual({ monthly_uploads_used: 0 });
  });
  it('blocks an exhausted quota without changing rows', async () => {
    await run();
    expect(await run([row(2)], 'b'.repeat(64))).toMatchObject({ code: 'QUOTA_EXCEEDED' });
    expect((await db.query('SELECT count(*)::int AS count FROM transactions')).rows[0]).toEqual({ count: 1 });
  });
  it('handles over 1,000 rows and detects duplicates beyond the old API cap', async () => {
    await db.exec("UPDATE profiles SET subscription_tier = 'pro'");
    const rows = Array.from({ length: 1205 }, (_, index) => row(index));
    expect(await run(rows)).toMatchObject({ transactionsCount: 1205 });
    expect(await run([row(1204), row(1205)], 'b'.repeat(64))).toMatchObject({ transactionsCount: 1, duplicatesSkipped: 1 });
  }, 20000);
  it('rejects direct browser execution and strips forged billing fields during profile creation', async () => {
    await db.exec("SET ROLE authenticated");
    await expect(run()).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role', 'authenticated', false)");
    await db.exec("INSERT INTO profiles(user_id, stripe_customer_id, subscription_status, subscription_tier) VALUES ('00000000-0000-4000-8000-000000000002', 'cus_someone_else', 'active', 'pro')");
    expect((await db.query("SELECT stripe_customer_id, subscription_status, subscription_tier FROM profiles WHERE user_id <> '" + uid + "'")).rows[0]).toEqual({ stripe_customer_id: null, subscription_status: 'inactive', subscription_tier: 'free' });
  });
  it('preserves historical categories when subscriptions have been cancelled', async () => {
    await run(); await db.exec("UPDATE detected_subscriptions SET status = 'cancelled'; UPDATE profiles SET subscription_tier = 'pro'");
    await run([{ ...row(2), date: '2026-10-02' }], 'b'.repeat(64));
    expect((await db.query('SELECT status FROM detected_subscriptions')).rows[0]).toEqual({ status: 'cancelled' });
    expect((await db.query("SELECT count(*)::int AS count FROM transactions WHERE category = 'Subscription'")).rows[0]).toEqual({ count: 2 });
  });
  it('denies ordinary authenticated execution and invalid savings goals', async () => {
    await db.exec("SELECT set_config('request.jwt.claim.role', 'authenticated', false)");
    await expect(run()).rejects.toThrow('Service role required');
    await expect(db.exec("INSERT INTO savings_goals VALUES ('Invalid',0,0)")).rejects.toThrow();
  });
  it('lets an owner correct legacy directions while preserving the original imported row', async () => {
    await run(); await db.exec('UPDATE transactions SET direction = NULL, amount = 12');
    const id = (await db.query<{ id: string }>('SELECT id FROM transactions')).rows[0].id;
    await db.exec('SET ROLE authenticated');
    await db.query("SELECT review_transaction($1, 'credit', 'Refund', NULL)", [id]);
    expect((await db.query('SELECT amount, direction, direction_override, category_override FROM transactions')).rows[0])
      .toEqual({ amount: '12.00', direction: null, direction_override: 'credit', category_override: 'Refund' });
    expect((await db.query('SELECT count(*)::int AS count FROM statement_reviews')).rows[0]).toEqual({ count: 1 });
    await expect(db.query("SELECT review_transaction($1, 'debit', 'Other', NULL)", [id])).rejects.toThrow('This record has changed');
    await expect(db.exec("DELETE FROM statement_reviews")).rejects.toThrow(/permission denied/);
  });
  it('blocks cross-account edits and keeps correction histories private through actual RLS', async () => {
    await run(); const id = (await db.query<{ id: string }>('SELECT id FROM transactions')).rows[0].id;
    const subId = (await db.query<{ id: string }>('SELECT id FROM detected_subscriptions')).rows[0].id;
    await db.exec('SET ROLE authenticated');
    await db.query("SELECT review_transaction($1, 'debit', 'Streaming', NULL)", [id]);
    await db.exec("SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false)");
    expect((await db.query('SELECT * FROM transactions')).rows).toEqual([]);
    expect((await db.query('SELECT * FROM statement_reviews')).rows).toEqual([]);
    await expect(db.query("SELECT review_transaction($1, 'credit', 'Income', NULL)", [id])).rejects.toThrow('Transaction unavailable');
    await expect(db.query("SELECT review_subscription($1, 'dismissed', 12, 'monthly', NULL)", [subId])).rejects.toThrow('Subscription unavailable');
    await db.exec("SELECT set_config('request.jwt.claim.sub', '', false)");
    await expect(db.query("SELECT review_transaction($1, 'debit', 'Other', NULL)", [id])).rejects.toThrow('Sign in required');
  });
  it('keeps subscription corrections and dismissals across subsequent imports', async () => {
    await run(); const id = (await db.query<{ id: string }>('SELECT id FROM detected_subscriptions')).rows[0].id;
    await db.exec('SET ROLE authenticated');
    await db.query("SELECT review_subscription($1, 'dismissed', 100, 'annual', NULL)", [id]);
    await db.exec("RESET ROLE; UPDATE profiles SET subscription_tier = 'pro'");
    await run([{ ...row(2), date: '2026-10-02' }], 'b'.repeat(64));
    expect((await db.query('SELECT status, amount, frequency, estimated_annual_cost, details_locked FROM detected_subscriptions')).rows[0])
      .toEqual({ status: 'dismissed', amount: '100.00', frequency: 'annual', estimated_annual_cost: '100.00', details_locked: true });
    await db.exec('SET ROLE authenticated');
    await db.query("SELECT review_subscription(id, 'active', amount, frequency, reviewed_at) FROM detected_subscriptions");
    expect((await db.query('SELECT status FROM detected_subscriptions')).rows[0]).toEqual({ status: 'active' });
  });
  it('rejects invalid correction values and direct browser updates', async () => {
    await run(); const id = (await db.query<{ id: string }>('SELECT id FROM detected_subscriptions')).rows[0].id;
    await db.exec('SET ROLE authenticated');
    for (const amount of [0, -1, 1.001, 100000000, 'NaN']) await expect(db.query("SELECT review_subscription($1, 'active', $2, 'monthly', NULL)", [id, amount])).rejects.toThrow();
    await expect(db.query("SELECT review_subscription($1, 'active', 10, 'sometimes', NULL)", [id])).rejects.toThrow();
    await db.exec("UPDATE transactions SET direction_override = 'credit'; UPDATE detected_subscriptions SET status = 'cancelled'");
    expect((await db.query('SELECT direction_override FROM transactions')).rows[0]).toEqual({ direction_override: null });
    expect((await db.query('SELECT status FROM detected_subscriptions')).rows[0]).toEqual({ status: 'active' });
  });
});

const requestId = '00000000-0000-4000-8000-100000000001';
const clearStatements = (confirmation = 'CLEAR', id: string | null = requestId) => db.query<{result: Record<string, unknown>}>('SELECT public.clear_statement_data($1,$2) AS result', [confirmation, id]).then(r => r.rows[0].result);
const asOwner = () => db.exec("SELECT set_config('request.jwt.claim.role','authenticated',false); SET ROLE authenticated");
describe('real PostgreSQL statement reset', () => {
  it('clears only owner imports and corrections, preserving goals, identity, plan and quota', async () => {
    await run();
    await db.exec(`INSERT INTO transactions(user_id,date,description,amount) VALUES ('00000000-0000-4000-8000-000000000002','2026-09-01','Other owner',-9);
      INSERT INTO savings_goals VALUES ('Keep my goal',100,20);
      UPDATE profiles SET monthly_spending_history='[{"month":"2026-09","spending":12}]';`);
    const removedIds = (await db.query('SELECT id FROM transactions WHERE user_id=auth.uid()')).rows;
    const profile = (await db.query('SELECT subscription_tier,monthly_uploads_used,uploads_reset_date,stripe_customer_id,subscription_status FROM profiles')).rows;
    await asOwner();
    await db.exec("SELECT review_transaction(id,'debit','Streaming',NULL) FROM transactions");
    expect(await clearStatements()).toMatchObject({cleared:true, transactions:1, subscriptions:1, reviews:1, imports:1});
    await db.exec('RESET ROLE');
    expect((await db.query('SELECT description FROM transactions')).rows).toEqual([{description:'Other owner'}]);
    const receipt=(await db.query<{deleted_record_ids:{transactions:string[]}}>('SELECT deleted_record_ids FROM app_private.statement_reset_receipts')).rows[0];
    expect(receipt.deleted_record_ids.transactions.map(id=>({id}))).toEqual(removedIds);
    for (const table of ['detected_subscriptions','statement_reviews','upload_history']) expect((await db.query(`SELECT * FROM ${table}`)).rows).toEqual([]);
    expect((await db.query('SELECT subscription_tier,monthly_uploads_used,uploads_reset_date,stripe_customer_id,subscription_status FROM profiles')).rows).toEqual(profile);
    expect((await db.query('SELECT monthly_spending_history FROM profiles')).rows).toEqual([{monthly_spending_history:[]}]);
    expect((await db.query('SELECT title FROM savings_goals')).rows).toEqual([{title:'Keep my goal'}]);
    expect((await db.query<{n:number}>('SELECT count(*)::int AS n FROM auth.users')).rows[0].n).toBe(2);
  });
  it('does not grant extra free uploads after clearing', async () => {
    await run(); await asOwner(); await clearStatements();
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role','service_role',false)");
    expect(await run()).toMatchObject({code:'QUOTA_EXCEEDED'});
    expect((await db.query('SELECT * FROM transactions')).rows).toEqual([]);
  });
  it('allows a fresh import with allowance and keeps it safe from replayed resets', async () => {
    await db.exec("UPDATE profiles SET subscription_tier='pro'");
    await run(); await asOwner(); const receipt = await clearStatements();
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role','service_role',false)");
    expect(await run()).toMatchObject({code:'OK',transactionsCount:1});
    await asOwner(); expect(await clearStatements()).toEqual(receipt);
    expect((await db.query<{n:number}>('SELECT count(*)::int AS n FROM transactions')).rows[0].n).toBe(1);
  });
  it('requires exact confirmation, a request ID, recent actual sign-in and an owner profile', async () => {
    await run(); await asOwner();
    await expect(clearStatements('clear')).rejects.toThrow('Type CLEAR');
    await expect(clearStatements('CLEAR',null)).rejects.toThrow('Type CLEAR');
    await db.exec("RESET ROLE; UPDATE auth.users SET last_sign_in_at=now()-interval '11 minutes'");
    await asOwner(); await expect(clearStatements()).rejects.toThrow('Sign in again');
    await db.exec("RESET ROLE; UPDATE auth.users SET last_sign_in_at=now(); SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false)");
    await asOwner(); await expect(clearStatements()).rejects.toThrow('profile unavailable');
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false)");
    await asOwner(); await expect(clearStatements()).rejects.toThrow('Please sign in');
    await db.exec('RESET ROLE');
    expect((await db.query<{n:number}>('SELECT count(*)::int AS n FROM transactions')).rows[0].n).toBe(1);
  });
  it('denies anonymous reset and direct receipt access', async () => {
    await run(); await db.exec('SET ROLE anon');
    await expect(clearStatements()).rejects.toThrow('permission denied');
    await db.exec('RESET ROLE'); await asOwner();
    await clearStatements();
    await expect(db.exec('SELECT * FROM app_private.statement_reset_receipts')).rejects.toThrow('permission denied');
    await expect(db.exec('DELETE FROM app_private.statement_reset_receipts')).rejects.toThrow('permission denied');
  });
  it('rejects resets while account closure is in progress', async () => {
    await run(); await db.query('INSERT INTO app_private.account_operations VALUES ($1,true)',[uid]); await asOwner();
    await expect(clearStatements()).rejects.toThrow('deletion is already in progress');
    expect((await db.query<{n:number}>('SELECT count(*)::int AS n FROM transactions')).rows[0].n).toBe(1);
  });
  it('rolls back all deletion if a later database operation fails', async () => {
    await run();
    await db.exec(`CREATE FUNCTION fail_test_reset() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$;
      CREATE TRIGGER fail_reset BEFORE DELETE ON upload_history FOR EACH ROW EXECUTE FUNCTION fail_test_reset();`);
    try {
      await asOwner(); await expect(clearStatements()).rejects.toThrow('injected failure');
      await db.exec('RESET ROLE');
      for (const table of ['transactions','detected_subscriptions','upload_history']) expect((await db.query<{n:number}>(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n).toBe(1);
      expect((await db.query('SELECT * FROM app_private.statement_reset_receipts')).rows).toEqual([]);
    } finally { await db.exec('RESET ROLE; DROP TRIGGER fail_reset ON upload_history; DROP FUNCTION fail_test_reset()'); }
  });
});
