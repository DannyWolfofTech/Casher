import Stripe from 'npm:stripe@18.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2.115.0';
import { billingState } from './billing-state.ts';
import { billingConfig, type BillingConfig } from './billing-config.ts';

export const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
export class BillingError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export const billingErrorResponse = (error: unknown) => {
  if (error instanceof BillingError) return json({ error: error.message }, error.status);
  console.error('[billing] Request failed', {
    name: error instanceof Error ? error.name : 'UnknownError',
    code: error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined,
  });
  return json({ error: 'Billing is temporarily unavailable. Please try again.' }, 503);
};
export function billingClients() {
  const config = billingConfig(Object.fromEntries(['STRIPE_SECRET_KEY_CUSTOM', 'STRIPE_MODE', 'STRIPE_ACCOUNT_ID', 'STRIPE_PRO_PRICE_ID', 'STRIPE_PREMIUM_PRICE_ID'].map(name => [name, Deno.env.get(name)])));
  return {
    config,
    stripe: new Stripe(config.key, { apiVersion: '2025-08-27.basil', httpClient: Stripe.createFetchHttpClient() }),
    admin: createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } }),
  };
}
let verifiedAccount: { key: string; accountId: string; until: number } | undefined;
export async function assertStripeAccount(stripe: Stripe, config: BillingConfig) {
  if (verifiedAccount?.key === config.key && verifiedAccount.accountId === config.accountId && verifiedAccount.until > Date.now()) return;
  const account = await stripe.accounts.retrieve();
  if (account.id !== config.accountId) throw new BillingError('Billing configuration needs attention.', 503);
  verifiedAccount = { key: config.key, accountId: account.id, until: Date.now() + 60_000 };
}
export async function billingContext(req: Request) {
  if (req.method !== 'POST') throw new BillingError('Use POST.', 405);
  const { stripe, admin, config } = billingClients();
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new BillingError('Please sign in.', 401);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user?.email) throw new BillingError('Please sign in again.', 401);
  await assertStripeAccount(stripe, config);
  const { data: profile, error: profileError } = await admin.from('profiles').select('stripe_customer_id').eq('user_id', user.id).single();
  if (profileError) throw new BillingError('Your billing profile could not be loaded.', 503);
  let customerId: string | null = profile.stripe_customer_id || null;
  if (customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted || (customer.metadata.user_id && customer.metadata.user_id !== user.id)) throw new BillingError('Your billing account needs support. Please try again later.', 409);
  } else {
    // A matching email alone does not prove ownership of a Stripe customer.
    const matches = await stripe.customers.search({ query: `metadata['user_id']:'${user.id}'`, limit: 2 });
    if (matches.data.length > 1) throw new BillingError('Your billing account needs support. Please try again later.', 409);
    customerId = matches.data[0]?.id ?? null;
  }
  return { stripe, admin, config, user, customerId };
}
export async function currentSubscriptions(stripe: Stripe, customerId: string) {
  const subscriptions: Stripe.Subscription[] = [];
  for await (const subscription of stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })) subscriptions.push(subscription);
  return subscriptions;
}
export async function syncCustomer(stripe: Stripe, admin: ReturnType<typeof billingClients>['admin'], customerId: string, userId?: string) {
  const { config } = billingClients();
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || (userId && customer.metadata.user_id && customer.metadata.user_id !== userId)) throw new BillingError('Billing identity does not match.', 409);
  userId = userId || customer.metadata.user_id;
  const state = billingState(await currentSubscriptions(stripe, customerId), config.priceToTier);
  const query = admin.from('profiles').update({ ...state, stripe_customer_id: customerId });
  const { data, error } = await (userId ? query.eq('user_id', userId).or(`stripe_customer_id.is.null,stripe_customer_id.eq.${customerId}`) : query.eq('stripe_customer_id', customerId)).select('user_id');
  if (error || !data?.length) throw new BillingError('Your billing status could not be saved.', 503);
  return state;
}
