import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { billingContext, billingErrorResponse, corsHeaders, currentSubscriptions, json } from '../_shared/billing.ts';
import { hasUnfinishedSubscription } from '../_shared/billing-state.ts';
import { isPurchasablePriceId, safeReturnOrigin } from '../_shared/stripe-guard.ts';

serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { stripe, admin, user, customerId: existingCustomerId } = await billingContext(req);
    const { priceId } = await req.json();
    if (!isPurchasablePriceId(priceId)) return json({ error: 'This plan is not available to purchase.' }, 400);
    const origin = safeReturnOrigin(req.headers.get('origin') || req.headers.get('referer'), Deno.env.get('ALLOWED_REDIRECT_ORIGINS'));
    let customerId = existingCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } }, { idempotencyKey: `customer:${user.id}` });
      customerId = customer.id;
      const { error } = await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('user_id', user.id);
      if (error) throw error;
    }
    if (!customerId) throw new Error('Billing account could not be created');
    // Existing, overdue and incomplete plans go to billing instead of charging twice.
    if (hasUnfinishedSubscription(await currentSubscriptions(stripe, customerId))) {
      const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${origin}/pricing` });
      return json({ url: portal.url });
    }
    const latest = (await stripe.checkout.sessions.list({ customer: customerId, limit: 1 })).data[0];
    if (latest?.status === 'open' && latest.url) return json({ url: latest.url });
    const session = await stripe.checkout.sessions.create({
      customer: customerId, line_items: [{ price: priceId, quantity: 1 }], mode: 'subscription',
      success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/pricing`,
      client_reference_id: user.id, metadata: { user_id: user.id }, subscription_data: { metadata: { user_id: user.id } },
    }, { idempotencyKey: `checkout:${user.id}:${priceId}:${latest?.id || 'first'}` });
    return json({ url: session.url });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: 'Invalid checkout request.' }, 400);
    return billingErrorResponse(error);
  }
});
