/**
 * Opt-in integration test: real Casher Stripe sandbox + actual Deno handlers.
 * Supabase Auth/PostgREST is an isolated in-memory adapter, NOT staging acceptance.
 * Requires --import-map=tools/billing-sandbox/import-map.json and a test secret.
 * --interactive exercises hosted Checkout and Portal in a browser; otherwise
 * Checkout is expired and the subscription is created with Stripe's test PM.
 */
import assert from 'node:assert/strict';
import Stripe from 'npm:stripe@18.5.0';
import { handlers } from './capture-server.ts';

const key = Deno.env.get('STRIPE_SECRET_KEY_CUSTOM') ?? '';
assert(key.startsWith('sk_test_'), 'Only sandbox secret keys are accepted');
const stripe = new Stripe(key, { apiVersion: '2025-08-27.basil', httpClient: Stripe.createFetchHttpClient() });
assert.equal((await stripe.accounts.retrieve()).id, 'acct_1SCrpvJMS012Ip2A', 'Wrong sandbox; refusing all mutations');
const priceId = 'price_1SYzJQJMS012Ip2AChBRKO5w';
const price = await stripe.prices.retrieve(priceId);
assert.equal(price.livemode, false);
assert.equal(price.unit_amount, 999);
assert.equal(price.currency, 'gbp');
const runId = crypto.randomUUID();
const userId = crypto.randomUUID();
const secondUserId = crypto.randomUUID();
const webhookSecret = `whsec_local_${crypto.randomUUID()}`;
const profile = { user_id: userId, stripe_customer_id: null as string | null, subscription_tier: 'free', subscription_status: 'inactive', current_period_end: null as string | null };
const secondProfile = { ...profile, user_id: secondUserId };
const profiles = [profile, secondProfile];
const audit = new Map<string, Record<string, unknown>>();
const results: { test: string; result: string }[] = [];
let failWrites = false;
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

// Deliberately implements only the Auth/profile/event operations used by billing.
const backend = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen() {} }, async req => {
  const url = new URL(req.url);
  if (url.pathname === '/auth/v1/user') {
    const id = req.headers.get('authorization') === 'Bearer fixture-user' ? userId : req.headers.get('authorization') === 'Bearer fixture-second-user' ? secondUserId : null;
    return id ? response({ id, email: `casher-release-${id}@example.test` }) : response({ message: 'Unauthorized' }, 401);
  }
  if (url.pathname === '/rest/v1/profiles') {
    if (failWrites && req.method === 'PATCH') return response({ message: 'Injected database outage' }, 503);
    const rows = profiles.filter(row => {
      if (url.searchParams.has('user_id') && url.searchParams.get('user_id') !== `eq.${row.user_id}`) return false;
      if (url.searchParams.has('stripe_customer_id') && url.searchParams.get('stripe_customer_id') !== `eq.${row.stripe_customer_id}`) return false;
      const or = url.searchParams.get('or');
      return !or || row.stripe_customer_id === null || or.includes(`stripe_customer_id.eq.${row.stripe_customer_id}`);
    });
    if (req.method === 'PATCH') { const body = await req.json(); rows.forEach(row => Object.assign(row, body)); }
    const single = req.headers.get('accept')?.includes('application/vnd.pgrst.object+json');
    return single ? rows.length === 1 ? response(rows[0]) : response({ message: 'Expected one row' }, 406) : response(rows);
  }
  if (url.pathname === '/rest/v1/webhook_events') {
    const body = await req.json();
    if (req.method === 'POST') audit.set(body.event_id, { ...audit.get(body.event_id), ...body });
    else if (req.method === 'PATCH') {
      const id = url.searchParams.get('event_id')?.replace(/^eq\./, '') ?? '';
      audit.set(id, { ...audit.get(id), ...body });
    } else throw new Error('Unexpected audit request');
    return response([]);
  }
  return response({ message: 'Unexpected test adapter route' }, 404);
});
Deno.env.set('SUPABASE_URL', `http://127.0.0.1:${backend.addr.port}`);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'fixture-service-key');
Deno.env.set('STRIPE_WEBHOOK_SECRET', webhookSecret);
Deno.env.set('STRIPE_ACCOUNT_ID', 'acct_1SCrpvJMS012Ip2A');
Deno.env.set('STRIPE_MODE', 'test');
Deno.env.set('STRIPE_PRO_PRICE_ID', priceId);
const names = ['create-checkout-session', 'check-subscription', 'customer-portal', 'stripe-webhook'];
for (const name of names) await import(`../../supabase/functions/${name}/index.ts`);
assert.equal(handlers.length, names.length, 'Use the test import map');
const call = async (name: string, body: unknown = {}, token = 'fixture-user') => {
  const res = await handlers[names.indexOf(name)](new Request(`http://localhost:8080/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: 'http://localhost:8080', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};
const deliver = async (event: Stripe.Event, invalid = false) => {
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = [...new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(`${timestamp}.${payload}`)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const res = await handlers[3](new Request('http://localhost:8080/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': `t=${timestamp},v1=${invalid ? '0'.repeat(64) : signature}` }, body: payload }));
  await res.text();
  return res.status;
};
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const until = async <T>(get: () => Promise<T>, accept: (value: T) => boolean, label: string, timeout = 120_000): Promise<T> => {
  const start = Date.now();
  while (true) {
    const value = await get();
    if (accept(value)) return value;
    if (Date.now() - start > timeout) throw new Error(`Timed out: ${label}`);
    await pause(2000);
  }
};
const pass = (name: string) => { results.push({ test: name, result: 'passed' }); console.log(`PASS ${name}`); };
const output = '.audit-results/stripe-sandbox';
await Deno.mkdir(output, { recursive: true });
const state = async (phase: string, details: Record<string, unknown>) => {
  await Deno.writeTextFile(`${output}/state.json`, JSON.stringify({ phase, runId, ...details }, null, 2));
  console.log(`BROWSER PHASE: ${phase}; URL available in ${output}/state.json`);
};
let clock: Stripe.TestHelpers.TestClock | undefined;
let customerId: string | undefined;
let subscriptionId: string | undefined;
let pendingCheckout: string | undefined;
try {
  assert.equal((await call('check-subscription', {}, 'invalid')).status, 401);
  pass('Unauthenticated billing is rejected');
  for (const body of [{ tier: 'premium' }, { tier: 'pro', priceId: 'price_forged' }, null]) assert.equal((await call('create-checkout-session', body)).status, 400);
  pass('Premium and forged checkout requests are rejected');
  assert.equal((await call('check-subscription')).body.tier, 'free');
  pass('A new account has no paid access');
  clock = await stripe.testHelpers.testClocks.create({ frozen_time: Math.floor(Date.now() / 1000), name: `Casher release ${runId}` });
  const customer = await stripe.customers.create({ name: `Casher release test ${runId}`, email: `casher-release-${runId}@example.test`, test_clock: clock.id, metadata: { user_id: userId, casher_release_test: runId } });
  assert.equal(customer.livemode, false);
  customerId = customer.id;
  profile.stripe_customer_id = customerId!;
  // Stripe and the real handler must agree on a single reusable checkout.
  const checkout = await call('create-checkout-session', { tier: 'pro' });
  assert.equal(checkout.status, 200);
  const duplicates = await Promise.all([call('create-checkout-session', { tier: 'pro' }), call('create-checkout-session', { tier: 'pro' })]);
  duplicates.forEach(result => { assert.equal(result.status, 200); assert.equal(result.body.url, checkout.body.url); });
  const sessions = await stripe.checkout.sessions.list({ customer: customerId });
  assert.equal(sessions.data.filter((session: Stripe.Checkout.Session) => session.status === 'open').length, 1);
  pendingCheckout = sessions.data[0].id;
  pass('Repeated and concurrent requests reuse one Stripe Checkout session');
  let subscription: Stripe.Subscription;
  if (Deno.args.includes('--interactive')) {
    await state('checkout', { url: checkout.body.url, customerId, sessionId: pendingCheckout });
    const completed = await until<Stripe.Checkout.Session>(() => stripe.checkout.sessions.retrieve(pendingCheckout!), session => session.status === 'complete', 'browser Checkout', 900_000);
    assert.equal(completed.payment_status, 'paid');
    subscriptionId = typeof completed.subscription === 'string' ? completed.subscription : completed.subscription!.id;
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
    pendingCheckout = undefined;
    pass('Hosted Checkout accepts a Stripe test card and completes payment');
  } else {
    await stripe.checkout.sessions.expire(pendingCheckout);
    pendingCheckout = undefined;
    const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customerId });
    subscription = await stripe.subscriptions.create({ customer: customerId, items: [{ price: priceId }], default_payment_method: pm.id, metadata: { user_id: userId } });
    subscriptionId = subscription.id;
    pass('Real Stripe test subscription payment succeeds (hosted UI excluded)');
  }
  assert.equal(subscription.status, 'active');
  const getEvent = async (type: string) => (await stripe.events.list({ type, limit: 100 })).data.find((event: Stripe.Event) => (event.data.object as { customer?: string }).customer === customerId);
  const created = await until(() => getEvent('customer.subscription.created'), Boolean, 'subscription event') as Stripe.Event;
  const sizeBefore = audit.size;
  assert.equal(await deliver(created, true), 400);
  assert.equal(audit.size, sizeBefore);
  pass('Invalid webhook signatures are rejected without audit writes');
  assert.equal(await deliver({ ...created, livemode: true }), 400);
  assert.equal(await deliver({ ...created, account: 'acct_wrong' }), 400);
  assert.equal(audit.size, sizeBefore);
  pass('Signed events from the wrong account or mode are rejected');
  assert.equal(await deliver(created), 200);
  assert.equal(profile.subscription_tier, 'pro');
  assert.equal(secondProfile.subscription_tier, 'free');
  assert.equal(audit.get(created.id)?.processing_status, 'succeeded');
  pass('A real Stripe event verifies in Deno and grants access only to its owner');
  assert.equal(await deliver(created), 200);
  assert.equal(audit.size, sizeBefore + 1);
  pass('Duplicate delivery is idempotent');
  assert.equal((await call('check-subscription')).body.tier, 'pro');
  const activeCheckout = await call('create-checkout-session', { tier: 'pro' });
  assert.equal(activeCheckout.status, 200);
  assert(new URL(activeCheckout.body.url).hostname === 'billing.stripe.com');
  assert.equal((await stripe.checkout.sessions.list({ customer: customerId })).data.length, 1);
  pass('An existing subscriber goes to the portal without a second checkout');
  const portal = await call('customer-portal');
  assert.equal(portal.status, 200);
  assert.equal((await call('customer-portal', {}, 'fixture-second-user')).status, 404);
  pass('The configured Stripe portal opens only for the linked customer');
  // Current state, never the old event payload, decides access after each transition.
  const advance = async (time: number) => {
    await stripe.testHelpers.testClocks.advance(clock!.id, { frozen_time: time });
    await until<Stripe.TestHelpers.TestClock>(() => stripe.testHelpers.testClocks.retrieve(clock!.id), value => value.status === 'ready', 'billing clock');
    subscription = await stripe.subscriptions.retrieve(subscriptionId!);
  };
  const firstInvoice = subscription.latest_invoice;
  await advance(subscription.items.data[0].current_period_end + 3600);
  subscription = await until<Stripe.Subscription>(() => stripe.subscriptions.retrieve(subscriptionId!), value => value.latest_invoice !== firstInvoice && value.status === 'active', 'successful renewal');
  assert.equal(await deliver(created), 200);
  assert.equal(profile.subscription_tier, 'pro');
  pass('Successful renewal preserves Pro and advances the billing period');
  const visa = await stripe.paymentMethods.attach('pm_card_visa', { customer: customerId });
  const declined = await stripe.paymentMethods.attach('pm_card_chargeCustomerFail', { customer: customerId });
  await stripe.subscriptions.update(subscriptionId, { default_payment_method: declined.id });
  await advance(subscription.items.data[0].current_period_end + 3600);
  subscription = await until<Stripe.Subscription>(() => stripe.subscriptions.retrieve(subscriptionId!), value => value.status === 'past_due', 'failed renewal');
  const failed = await until(() => getEvent('invoice.payment_failed'), Boolean, 'failed invoice event') as Stripe.Event;
  assert.equal(await deliver(failed), 200);
  assert.equal(profile.subscription_tier, 'free');
  assert.equal(profile.subscription_status, 'past_due');
  const overdueCheckout = await call('create-checkout-session', { tier: 'pro' });
  assert.equal(overdueCheckout.status, 200);
  assert.equal(new URL(overdueCheckout.body.url).hostname, 'billing.stripe.com');
  pass('Failed renewal removes paid access and overdue checkout opens billing');
  await stripe.subscriptions.update(subscriptionId, { default_payment_method: visa.id });
  const invoiceId = typeof subscription.latest_invoice === 'string' ? subscription.latest_invoice : subscription.latest_invoice!.id;
  assert(invoiceId, 'A failed renewal must have an invoice');
  await stripe.invoices.pay(invoiceId, { payment_method: visa.id });
  await until<Stripe.Subscription>(() => stripe.subscriptions.retrieve(subscriptionId!), value => value.status === 'active', 'payment recovery');
  const paid = await until(() => getEvent('invoice.paid'), Boolean, 'paid invoice event') as Stripe.Event;
  assert.equal(await deliver(paid), 200);
  assert.equal(profile.subscription_tier, 'pro');
  assert.equal(await deliver(failed), 200);
  assert.equal(profile.subscription_tier, 'pro');
  pass('Payment recovery restores Pro and replaying an old failure cannot revoke it');
  failWrites = true;
  assert.equal(await deliver(paid), 500);
  assert.equal(audit.get(paid.id)?.processing_status, 'failed');
  failWrites = false;
  assert.equal(await deliver(paid), 200);
  assert.equal(audit.get(paid.id)?.processing_status, 'succeeded');
  pass('A database failure returns a retryable error and replay recovers');
  if (Deno.args.includes('--interactive')) {
    const cancellationPortal = await call('customer-portal');
    await state('portal-cancellation', { url: cancellationPortal.body.url, customerId, subscriptionId });
    subscription = await until<Stripe.Subscription>(() => stripe.subscriptions.retrieve(subscriptionId!), value => value.cancel_at_period_end, 'browser portal cancellation', 900_000);
    pass('Hosted billing portal schedules cancellation');
  } else subscription = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  assert.equal(await deliver(created), 200);
  assert.equal(profile.subscription_tier, 'pro');
  pass('Scheduled cancellation preserves the already-paid period');
  await advance(subscription.items.data[0].current_period_end + 3600);
  assert.equal(subscription.status, 'canceled');
  const deleted = await until(() => getEvent('customer.subscription.deleted'), Boolean, 'cancellation event') as Stripe.Event;
  assert.equal(await deliver(deleted), 200);
  assert.equal(profile.subscription_tier, 'free');
  assert.equal(await deliver(created), 200);
  assert.equal(profile.subscription_tier, 'free');
  pass('Cancellation removes Pro and old subscription events cannot re-grant it');
  // A forged/stale linkage cannot replace an established customer on another account.
  profile.stripe_customer_id = 'cus_different_anchor';
  assert.equal(await deliver(created), 500);
  assert.equal(profile.stripe_customer_id, 'cus_different_anchor');
  profile.stripe_customer_id = customerId!;
  pass('Webhook metadata cannot overwrite an established billing identity');
  await state('complete', { tests: results.length });
} catch (error) {
  // Errors from the Stripe SDK can carry request details; report only the message.
  console.error('FAIL', error instanceof Error ? error.message : 'Sandbox test failed');
  results.push({ test: 'Run completion', result: 'failed' });
  Deno.exitCode = 1;
} finally {
  failWrites = false;
  if (pendingCheckout) await stripe.checkout.sessions.expire(pendingCheckout).catch(() => {});
  // Deleting our named test clock also removes its own synthetic customer/subscriptions.
  // No pre-existing customer is ever selected for mutation or cleanup.
  if (clock) await stripe.testHelpers.testClocks.del(clock.id).catch(() => console.error('Cleanup needs attention: test clock', clock!.id));
  await backend.shutdown();
  await Deno.writeTextFile(`${output}/results.json`, JSON.stringify({ runId, time: new Date().toISOString(), account: 'acct_1SCrpvJMS012Ip2A', mode: 'test', database: 'isolated in-memory Auth/PostgREST adapter', interactive: Deno.args.includes('--interactive'), results }, null, 2));
  console.log(`Finished: ${results.filter(result => result.result === 'passed').length} passed; ${results.filter(result => result.result === 'failed').length} failed.`);
}
