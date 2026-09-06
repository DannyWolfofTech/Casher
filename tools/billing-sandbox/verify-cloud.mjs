// Connected-cloud smoke checks, restricted to explicitly created release users.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/).filter(line => line.includes('=')).map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, '')]; }));
const url = env.VITE_SUPABASE_URL;
assert.equal(url, 'https://ewnjmvxildwmbdmosasz.supabase.co');
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const accounts = JSON.parse(await readFile('.audit-results/cloud-acceptance-users.json', 'utf8'));
assert.equal(accounts.length, 2);
assert(accounts.every(a => /^casher-release-[0-9a-f-]+@example\.test$/.test(a.email)));
const results = [];
const pass = test => { results.push({ test, result: 'passed' }); console.log(`PASS ${test}`); };
const ok = response => { assert.equal(response.error, null, response.error?.message); return response.data; };
const users = [];
const invoke = async (user, name, body) => {
  const response = await fetch(`${url}/functions/v1/${name}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${user?.token || 'invalid'}`, 'Content-Type': 'application/json', Origin: 'https://trycasher.com' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  return { status: response.status, body: await response.json() };
};
try {
  for (const account of accounts) {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) } });
    const login = ok(await client.auth.signInWithPassword(account));
    users.push({ ...account, id: login.user.id, token: login.session.access_token, client });
  }
  await writeFile('.audit-results/cloud-test-identities.json', JSON.stringify(users.map(({ id, email }) => ({ id, email })), null, 2));
  const [a, b] = users;
  assert.equal(ok(await a.client.from('profiles').select('user_id')).length, 1);
  assert.equal(ok(await b.client.from('profiles').select('user_id').eq('user_id', a.id)).length, 0);
  pass('Two real cloud logins have isolated profiles');
  assert.equal((await invoke(null, 'process-csv', {})).status, 401);
  assert.equal((await invoke(a, 'process-csv', {})).status, 422);
  pass('The deployed import rejects anonymous and empty requests');
  const csv = 'Date,Description,Money Out,Money In\n01/09/2026,Release Payroll,,3000.00\n02/09/2026,Release Coffee,4.50,\n02/09/2026,Release Coffee,4.50,\n03/09/2026,Netflix,10.99,\n';
  const imported = await invoke(a, 'process-csv', { csv });
  assert.equal(imported.status, 200, JSON.stringify(imported.body));
  assert([0, 4].includes(imported.body.transactionsCount));
  const rows = ok(await a.client.from('transactions').select('*'));
  assert.equal(rows.length, 4);
  assert.equal(rows.filter(r => r.description === 'Release Coffee').length, 2);
  assert.equal(rows.filter(r => r.direction === 'debit').reduce((total, r) => total + Math.round(Math.abs(r.amount) * 100), 0), 1999);
  assert.equal(rows.find(r => r.description === 'Release Payroll').direction, 'credit');
  pass('The deployed import preserves repeated purchases and exact debit/credit totals');
  const replay = await invoke(a, 'process-csv', { csv });
  assert.equal(replay.body.code, 'REPLAY');
  assert.equal((await invoke(a, 'process-csv', { csv: csv + '04/09/2026,Release Extra,1.00,\n' })).status, 429);
  assert.equal(ok(await a.client.from('transactions').select('id')).length, 4);
  pass('Cloud replay and exhausted quota leave stored transactions unchanged');
  assert.equal(ok(await b.client.from('transactions').select('*').eq('user_id', a.id)).length, 0);
  const row = rows.find(r => r.description === 'Release Coffee');
  assert((await b.client.rpc('review_transaction', { _id: row.id, _direction: 'credit', _category: 'Income' })).error);
  const previousReviews = ok(await a.client.from('statement_reviews').select('id')).length;
  ok(await a.client.rpc('review_transaction', { _id: row.id, _direction: 'credit', _category: 'Income', _expected_reviewed_at: row.reviewed_at || undefined }));
  assert.equal((await a.client.rpc('review_transaction', { _id: row.id, _direction: 'debit', _category: 'Other' })).error.code, 'PT409');
  assert.equal(ok(await a.client.from('statement_reviews').select('id')).length, previousReviews + 1);
  assert.equal(ok(await b.client.from('statement_reviews').select('id')).length, 0);
  pass('Cloud corrections enforce ownership, retain history and reject stale edits');
  const goals = ok(await a.client.from('savings_goals').insert({ user_id: a.id, title: 'Release acceptance', target_amount: 100, current_amount: 25 }).select());
  assert.equal(ok(await b.client.from('savings_goals').select('id').eq('id', goals[0].id)).length, 0);
  ok(await a.client.from('savings_goals').delete().eq('id', goals[0].id));
  pass('Cloud goals persist, stay private and can be deleted');
  const subscription = await invoke(a, 'check-subscription', {});
  assert.equal(subscription.status, 200, JSON.stringify(subscription.body));
  pass('Deployed billing can authenticate and verify its configured Stripe account');
  const denied = await invoke(a, 'create-checkout-session', { tier: 'premium' });
  assert.equal(denied.status, 400);
  const checkout = await invoke(a, 'create-checkout-session', { tier: 'pro' });
  assert.equal(checkout.status, 200, JSON.stringify(checkout.body));
  assert(new URL(checkout.body.url).hostname === 'checkout.stripe.com');
  assert(checkout.body.url.includes('cs_test_'), 'This acceptance phase must stay in Stripe sandbox');
  const legacy = await invoke(a, 'create-checkout', { tier: 'pro' });
  assert.equal(legacy.status, 200);
  assert.equal(legacy.body.url, checkout.body.url);
  await writeFile('.audit-results/cloud-checkout.json', JSON.stringify({ userId: a.id, url: checkout.body.url }, null, 2));
  pass('Both cloud checkout URLs reuse one sandbox session and reject unfinished Premium');
} catch (error) {
  results.push({ test: error.message, result: 'failed' });
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
} finally {
  await writeFile('.audit-results/cloud-acceptance.json', JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  console.log(`Finished: ${results.filter(r => r.result === 'passed').length} passed; ${results.filter(r => r.result === 'failed').length} failed.`);
}
