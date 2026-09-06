// Full local Supabase Auth, PostgREST, PostgreSQL and deployed edge integration.
// The status file is produced with `supabase status -o json` and never committed.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID, createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const config = JSON.parse(await readFile('.audit-results/local-supabase.json', 'utf8'));
const url = config.API_URL;
assert.equal(new URL(url).hostname, '127.0.0.1', 'Only an isolated local Supabase is allowed');
assert.equal(new URL(url).port, '54321');
const admin = createClient(url, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const run = randomUUID();
const users = [];
let stripeClock;
const stripeApi = async (path, fields, method = fields ? 'POST' : 'GET') => {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY_CUSTOM}`, 'Stripe-Version': '2025-08-27.basil', 'Content-Type': 'application/x-www-form-urlencoded' }, ...(fields ? { body: new URLSearchParams(fields) } : {}) });
  const data = await res.json();
  assert(res.ok, data.error?.message || `Stripe returned ${res.status}`);
  return data;
};
const results = [];
const pass = name => { results.push({ test: name, result: 'passed' }); console.log(`PASS ${name}`); };
const ok = result => { assert.equal(result.error, null, result.error?.message); return result.data; };
const invoke = async (user, name, body) => {
  const res = await fetch(`${url}/functions/v1/${name}`, { method: 'POST', headers: { apikey: config.ANON_KEY, Authorization: `Bearer ${user?.token || 'invalid'}`, 'Content-Type': 'application/json', Origin: 'http://localhost:8080' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  return { status: res.status, body: await res.json() };
};
const csv = 'Date,Description,Money Out,Money In\n01/09/2026,Payroll,,3000.00\n02/09/2026,Test Coffee,4.50,\n02/09/2026,Test Coffee,4.50,\n03/09/2026,Netflix,10.99,\n';
try {
  for (let i = 0; i < 3; i++) {
    const email = `casher-local-${run}-${i}@example.test`;
    const password = `Casher-test-${randomUUID()}!`;
    const created = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
    const client = createClient(url, config.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = ok(await client.auth.signInWithPassword({ email, password }));
    users.push({ id: created.user.id, email, password, client, token: signedIn.session.access_token });
  }
  const [a, b, c] = users;
  // An anonymous 401 comes from the gateway even while `functions serve` is
  // restarting. Wait for the actual handlers and the test environment instead.
  const readyDeadline = Date.now() + 120000;
  let ready = false;
  let readiness = 'No function response';
  while (Date.now() < readyDeadline) {
    try {
      const importProbe = await invoke(a, 'process-csv', {});
      readiness = `Import function returned ${importProbe.status}`;
      if (importProbe.status === 422 && importProbe.body.code === 'INVALID_PAYLOAD') {
        const previewProbe = await fetch(`${url}/functions/v1/auth-email-hook/preview`, { method: 'POST', headers: { Authorization: 'Bearer casher-local-email-fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'recovery' }), signal: AbortSignal.timeout(15000) });
        readiness = `Email function returned ${previewProbe.status}`;
        ready = previewProbe.status === 200 && (await previewProbe.text()).includes('Casher');
      }
    } catch (error) { readiness = error.name; }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert(ready, `Local functions did not become ready with the test environment: ${readiness}`);
  assert.equal(ok(await a.client.from('profiles').select('*')).length, 1);
  assert.equal(ok(await a.client.from('profiles').select('*').eq('user_id', b.id)).length, 0);
  pass('Real Supabase login creates private profiles for three independent users');
  assert.equal((await invoke(null, 'process-csv', { csv })).status, 401);
  pass('The edge gateway rejects anonymous imports');
  const imported = await invoke(a, 'process-csv', { csv });
  assert.equal(imported.status, 200, JSON.stringify(imported.body));
  assert.equal(imported.body.transactionsCount, 4);
  const rows = ok(await a.client.from('transactions').select('*').order('date'));
  assert.equal(rows.length, 4);
  assert.equal(rows.filter(row => row.description === 'Test Coffee').length, 2);
  assert.equal(rows.find(row => row.description === 'Payroll').direction, 'credit');
  assert.equal(rows.filter(row => row.direction === 'debit').reduce((sum, row) => sum + Math.round(Math.abs(row.amount) * 100), 0), 1999);
  assert.equal(ok(await a.client.from('upload_history').select('*')).length, 1);
  pass('A real edge import preserves repeated purchases, credits, exact spending and history');
  const replay = await invoke(a, 'process-csv', { csv });
  assert.equal(replay.body.code, 'REPLAY');
  const overQuota = await invoke(a, 'process-csv', { csv: 'Date,Description,Amount\n04/09/2026,New purchase,-7.00\n' });
  assert.equal(overQuota.status, 429);
  assert.equal(ok(await a.client.from('transactions').select('id')).length, 4);
  assert.equal(ok(await admin.from('profiles').select('monthly_uploads_used').eq('user_id', a.id).single()).monthly_uploads_used, 1);
  pass('Replay is harmless and quota denial leaves transactions and usage unchanged');
  const simultaneous = await Promise.all([invoke(b, 'process-csv', { csv: 'Date,Description,Amount\n01/09/2026,Concurrent A,-1.00\n' }), invoke(b, 'process-csv', { csv: 'Date,Description,Amount\n02/09/2026,Concurrent B,-2.00\n' })]);
  assert.deepEqual(simultaneous.map(result => result.status).sort(), [200, 429]);
  assert.equal(ok(await b.client.from('transactions').select('id')).length, 1);
  assert.equal(ok(await b.client.from('upload_history').select('id')).length, 1);
  pass('Concurrent real edge requests cannot exceed the free upload limit');
  for (const table of ['transactions', 'detected_subscriptions', 'upload_history', 'profiles', 'statement_reviews']) {
    assert.equal(ok(await b.client.from(table).select('*').eq('user_id', a.id)).length, 0, table);
  }
  assert((await a.client.from('transactions').insert({ user_id: a.id, date: '2026-09-01', description: 'Injected', amount: 1 })).error);
  assert((await a.client.from('upload_history').insert({ user_id: a.id })).error);
  assert((await a.client.rpc('import_statement_atomic', { _user_id: a.id, _csv_hash: 'a'.repeat(64), _transactions: [], _subscriptions: [] })).error);
  pass('Authenticated users cannot read other accounts or bypass server-owned import writes');
  ok(await a.client.from('profiles').update({ subscription_tier: 'premium', stripe_customer_id: 'cus_forged', monthly_uploads_used: 0 }).eq('user_id', a.id));
  const guarded = ok(await admin.from('profiles').select('*').eq('user_id', a.id).single());
  assert.equal(guarded.subscription_tier, 'free');
  assert.equal(guarded.stripe_customer_id, null);
  assert.equal(guarded.monthly_uploads_used, 1);
  pass('Browser profile writes cannot grant Premium, replace billing identity or reset quota');
  const row = rows.find(row => row.description === 'Test Coffee');
  assert((await b.client.rpc('review_transaction', { _id: row.id, _direction: 'credit', _category: 'Income' })).error);
  const corrected = ok(await a.client.rpc('review_transaction', { _id: row.id, _direction: 'credit', _category: 'Income' }));
  assert(corrected.reviewed_at);
  assert.equal((await a.client.rpc('review_transaction', { _id: row.id, _direction: 'debit', _category: 'Other' })).error.code, '40001');
  const afterReview = ok(await a.client.from('transactions').select('*').eq('id', row.id).single());
  assert.equal(afterReview.direction, 'debit');
  assert.equal(afterReview.direction_override, 'credit');
  assert.equal(afterReview.amount, row.amount);
  assert.equal(ok(await a.client.from('statement_reviews').select('*')).length, 1);
  pass('Correction RPCs enforce ownership, stale-edit protection and immutable source values');
  const subscription = ok(await a.client.from('detected_subscriptions').select('*'))[0];
  assert(subscription);
  ok(await a.client.rpc('review_subscription', { _id: subscription.id, _status: 'dismissed', _amount: 15, _frequency: 'weekly' }));
  ok(await admin.from('profiles').update({ subscription_tier: 'pro' }).eq('user_id', a.id));
  const overlap = await invoke(a, 'process-csv', { csv: csv + '04/09/2026,Netflix,12.99,\n' });
  assert.equal(overlap.status, 200);
  assert.equal(overlap.body.transactionsCount, 1);
  const preserved = ok(await a.client.from('detected_subscriptions').select('*').eq('id', subscription.id).single());
  assert.equal(preserved.status, 'dismissed');
  assert.equal(preserved.amount, 15);
  assert.equal(preserved.frequency, 'weekly');
  assert.equal(preserved.estimated_annual_cost, 780);
  pass('Later overlapping imports preserve corrected subscriptions and repeated-purchase counts');
  const malformed = await invoke(c, 'process-csv', { csv: 'Date,Description,Money Out,Money In\n01/09/2026,Ambiguous,10,20\n' });
  assert.equal(malformed.status, 422);
  assert.equal(ok(await c.client.from('transactions').select('id')).length, 0);
  assert.equal(ok(await c.client.from('profiles').select('monthly_uploads_used').single()).monthly_uploads_used, 0);
  pass('Malformed input produces a useful error and consumes no quota');
  ok(await admin.from('profiles').update({ uploads_reset_date: '2026-01-01', monthly_uploads_used: 1 }).eq('user_id', c.id));
  assert.equal((await invoke(c, 'process-csv', { csv })).status, 200);
  assert.equal(ok(await c.client.from('profiles').select('monthly_uploads_used').single()).monthly_uploads_used, 1);
  pass('The real database resets monthly quota at a new month');
  const goal = ok(await a.client.from('savings_goals').insert({ user_id: a.id, title: 'Release test goal', target_amount: 100, current_amount: 5 }).select().single());
  assert.equal(ok(await b.client.from('savings_goals').select('*').eq('id', goal.id)).length, 0);
  assert((await a.client.from('savings_goals').insert({ user_id: a.id, title: 'Invalid', target_amount: -1 })).error);
  ok(await a.client.from('savings_goals').delete().eq('id', goal.id));
  pass('Goals persist with positive targets and account isolation');
  const emailKey = 'casher-local-email-fixture';
  for (const type of ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'reauthentication']) {
    const preview = await fetch(`${url}/functions/v1/auth-email-hook/preview`, { method: 'POST', headers: { Authorization: `Bearer ${emailKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) });
    assert.equal(preview.status, 200, `Email preview: ${type}`);
    const html = await preview.text();
    assert(html.includes('Casher'));
    assert(!html.includes('master-vault-download'));
  }
  pass('All six actual email templates render with Casher branding');
  const emailHook = async payload => {
    const body = JSON.stringify(payload);
    const timestamp = String(Date.now());
    const signature = 'sha256=' + createHmac('sha256', emailKey).update(`${timestamp}.${body}`).digest('hex');
    return fetch(`${url}/functions/v1/auth-email-hook`, { method: 'POST', headers: { 'x-lovable-timestamp': timestamp, 'x-lovable-signature': signature }, body });
  };
  const invalidEmail = await emailHook({ version: '1', type: 'auth', run_id: run });
  assert.equal(invalidEmail.status, 400);
  await invalidEmail.text();
  const queuedEmail = await emailHook({ version: '1', type: 'auth', run_id: run, data: { action_type: 'signup', email: a.email, url: 'https://trycasher.com/auth', token: '123456' } });
  assert.equal(queuedEmail.status, 200);
  await queuedEmail.text();
  const queued = ok(await admin.rpc('read_email_batch', { queue_name: 'auth_emails', batch_size: 100, vt: 30 }));
  const ownMessages = queued.filter(message => message.message.run_id === run);
  assert.equal(ownMessages.length, 1);
  assert.equal(ownMessages[0].message.from, 'Casher <noreply@trycasher.com>');
  assert.equal(ownMessages[0].message.to, a.email);
  for (const message of ownMessages) ok(await admin.rpc('delete_email', { queue_name: 'auth_emails', message_id: message.msg_id }));
  pass('The signed email hook rejects missing fields and queues the correct branded message');
  assert.equal((await invoke(a, 'process-email-queue', {})).status, 403);
  pass('Ordinary accounts cannot invoke the privileged email dispatcher');
  if (process.argv.includes('--stripe')) {
    assert(process.env.STRIPE_SECRET_KEY_CUSTOM?.startsWith('sk_test_'));
    assert(process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_local_'), 'Use a local test signing secret');
    assert.equal((await stripeApi('account')).id, 'acct_1SCrpvJMS012Ip2A');
    const priceId = 'price_1SYzJQJMS012Ip2AChBRKO5w';
    assert.equal((await stripeApi(`prices/${priceId}`)).livemode, false);
    assert.equal((await invoke(a, 'create-checkout', { tier: 'premium' })).status, 400);
    stripeClock = await stripeApi('test_helpers/test_clocks', { frozen_time: Math.floor(Date.now() / 1000), name: `Casher local Supabase ${run}` });
    const customer = await stripeApi('customers', { name: `Casher local Supabase ${run}`, email: a.email, test_clock: stripeClock.id, 'metadata[user_id]': a.id, 'metadata[casher_release_test]': run });
    assert.equal(customer.livemode, false);
    ok(await admin.from('profiles').update({ stripe_customer_id: customer.id, subscription_tier: 'free', subscription_status: 'inactive' }).eq('user_id', a.id));
    const checkout = await invoke(a, 'create-checkout-session', { tier: 'pro' });
    assert.equal(checkout.status, 200, JSON.stringify(checkout.body));
    assert.equal(new URL(checkout.body.url).hostname, 'checkout.stripe.com');
    const repeated = await invoke(a, 'create-checkout', { tier: 'pro' });
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.url, checkout.body.url);
    const sessions = await stripeApi(`checkout/sessions?customer=${customer.id}`);
    assert.equal(sessions.data.length, 1);
    await stripeApi(`checkout/sessions/${sessions.data[0].id}/expire`, {});
    pass('Both deployed checkout URLs share one authenticated Stripe session');
    const pm = await stripeApi('payment_methods/pm_card_visa/attach', { customer: customer.id });
    const subscription = await stripeApi('subscriptions', { customer: customer.id, 'items[0][price]': priceId, default_payment_method: pm.id, 'metadata[user_id]': a.id });
    assert.equal(subscription.status, 'active');
    const event = async type => {
      for (let i = 0; i < 20; i++) {
        const data = await stripeApi(`events?type=${type}&limit=100`);
        const found = data.data.find(value => value.data.object.customer === customer.id);
        if (found) return found;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      throw new Error('Expected sandbox event');
    };
    const deliver = async (event, valid = true) => {
      const payload = JSON.stringify(event);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest('hex');
      const res = await fetch(`${url}/functions/v1/stripe-webhook`, { method: 'POST', headers: { 'stripe-signature': `t=${timestamp},v1=${valid ? signature : '0'.repeat(64)}` }, body: payload });
      await res.text();
      return res.status;
    };
    const created = await event('customer.subscription.created');
    assert.equal(await deliver(created, false), 400);
    assert.equal(await deliver(created), 200);
    assert.equal(await deliver(created), 200);
    const paidProfile = ok(await a.client.from('profiles').select('*').single());
    assert.equal(paidProfile.subscription_tier, 'pro');
    assert.equal(paidProfile.stripe_customer_id, customer.id);
    assert.equal(ok(await b.client.from('profiles').select('subscription_tier').single()).subscription_tier, 'free');
    const logged = ok(await admin.from('webhook_events').select('processing_status').eq('event_id', created.id));
    assert.equal(logged.length, 1);
    assert.equal(logged[0].processing_status, 'succeeded');
    pass('The deployed webhook verifies real Stripe events and persists one owner-scoped entitlement');
    assert.equal((await invoke(a, 'check-subscription', {})).body.tier, 'pro');
    const portal = await invoke(a, 'customer-portal', {});
    assert.equal(portal.status, 200);
    assert.equal(new URL(portal.body.url).hostname, 'billing.stripe.com');
    const existing = await invoke(a, 'create-checkout-session', { tier: 'pro' });
    assert.equal(existing.status, 200);
    assert.equal(new URL(existing.body.url).hostname, 'billing.stripe.com');
    await stripeApi(`subscriptions/${subscription.id}`, undefined, 'DELETE');
    assert.equal(await deliver(await event('customer.subscription.deleted')), 200);
    assert.equal(await deliver(created), 200);
    assert.equal(ok(await a.client.from('profiles').select('subscription_tier').single()).subscription_tier, 'free');
    pass('Deployed billing refresh, portal, cancellation and old-event replay agree with PostgreSQL');
  }
  // The local SMTP catcher receives mail; this cannot send to an external inbox.
  ok(await c.client.auth.resetPasswordForEmail(c.email, { redirectTo: 'http://localhost:3000/auth' }));
  let mail;
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch(`${config.MAILPIT_URL}/api/v1/messages`)).json();
    mail = list.messages?.find(message => message.To?.some(to => to.Address === c.email));
    if (mail) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert(mail, 'Recovery mail must reach the local SMTP catcher');
  const message = await (await fetch(`${config.MAILPIT_URL}/api/v1/message/${mail.ID}`)).json();
  const verifyUrl = message.HTML.match(/href="([^"]*\/auth\/v1\/verify[^\"]*)"/)?.[1]?.replaceAll('&amp;', '&');
  assert(verifyUrl, 'Recovery mail must contain a verification link');
  assert(['127.0.0.1', 'localhost'].includes(new URL(verifyUrl).hostname));
  const verified = await fetch(verifyUrl, { redirect: 'manual' });
  const redirect = new URL(verified.headers.get('location'));
  const tokens = new URLSearchParams(redirect.hash.slice(1));
  assert(tokens.get('access_token'));
  const recovered = createClient(url, config.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  ok(await recovered.auth.setSession({ access_token: tokens.get('access_token'), refresh_token: tokens.get('refresh_token') }));
  const newPassword = `Recovered-${randomUUID()}!`;
  ok(await recovered.auth.updateUser({ password: newPassword }));
  await recovered.auth.signOut();
  assert((await recovered.auth.signInWithPassword({ email: c.email, password: c.password })).error);
  ok(await recovered.auth.signInWithPassword({ email: c.email, password: newPassword }));
  const replayLink = await fetch(verifyUrl, { redirect: 'manual' });
  assert(new URL(replayLink.headers.get('location')).hash.includes('error'));
  await recovered.auth.signOut();
  pass('Recovery email, one-use link and password replacement work through real local Auth');
} catch (error) {
  console.error('FAIL', error.message);
  results.push({ test: 'Run completion', result: 'failed' });
  process.exitCode = 1;
} finally {
  if (stripeClock) await stripeApi(`test_helpers/test_clocks/${stripeClock.id}`, undefined, 'DELETE');
  for (const user of users) { await user.client.auth.signOut(); ok(await admin.auth.admin.deleteUser(user.id)); }
  await writeFile('.audit-results/supabase-integration.json', JSON.stringify({ time: new Date().toISOString(), environment: 'full local Supabase with all migrations and actual edge functions', results }, null, 2));
  console.log(`Finished: ${results.filter(result => result.result === 'passed').length} passed; ${results.filter(result => result.result === 'failed').length} failed.`);
}
