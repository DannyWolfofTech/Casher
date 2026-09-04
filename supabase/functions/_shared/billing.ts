import Stripe from 'https://esm.sh/stripe@18.5.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { billingState } from './billing-state.ts';

export const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
export class BillingError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export const billingErrorResponse = (error: unknown) => {
  if (error instanceof BillingError) return json({ error: error.message }, error.status);
  console.error('[billing] Request failed');
  return json({ error: 'Billing is temporarily unavailable. Please try again.' }, 503);
};
export function billingClients() {
  const key = Deno.env.get('STRIPE_SECRET_KEY_CUSTOM');
  if (!key) throw new BillingError('Billing is temporarily unavailable.', 503);
  return {
    stripe: new Stripe(key, { apiVersion: '2025-08-27.basil', httpClient: Stripe.createFetchHttpClient() }),
    admin: createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } }),
  };
}
export async function billingContext(req: Request) {
  if (req.method !== 'POST') throw new BillingError('Use POST.', 405);
  const { stripe, admin } = billingClients();
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new BillingError('Please sign in.', 401);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user?.email) throw new BillingError('Please sign in again.', 401);
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
  return { stripe, admin, user, customerId };
}
export async function currentSubscriptions(stripe: Stripe, customerId: string) {
  const subscriptions: Stripe.Subscription[] = [];
  for await (const subscription of stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })) subscriptions.push(subscription);
  return subscriptions;
}
export async function syncCustomer(stripe: Stripe, admin: ReturnType<typeof billingClients>['admin'], customerId: string, userId?: string) {
  const state = billingState(await currentSubscriptions(stripe, customerId));
  const query = admin.from('profiles').update({ ...state, stripe_customer_id: customerId });
  const { data, error } = await (userId ? query.eq('user_id', userId) : query.eq('stripe_customer_id', customerId)).select('user_id');
  if (error || !data?.length) throw new BillingError('Your billing status could not be saved.', 503);
  return state;
}
