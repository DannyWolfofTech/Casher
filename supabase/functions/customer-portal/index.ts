import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { billingContext, billingErrorResponse, corsHeaders, json } from '../_shared/billing.ts';
import { safeReturnOrigin } from '../_shared/stripe-guard.ts';
serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { stripe, customerId } = await billingContext(req);
    if (!customerId) return json({ error: 'There is no paid billing account for this user yet.' }, 404);
    const origin = safeReturnOrigin(req.headers.get('origin') || req.headers.get('referer'), Deno.env.get('ALLOWED_REDIRECT_ORIGINS'));
    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${origin}/pricing` });
    return json({ url: session.url });
  } catch (error) { return billingErrorResponse(error); }
});
