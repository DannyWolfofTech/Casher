import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { billingContext, billingErrorResponse, corsHeaders, json, syncCustomer } from '../_shared/billing.ts';

serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { stripe, admin, user, customerId } = await billingContext(req);
    if (!customerId) {
      const { error } = await admin.from('profiles').update({ subscription_tier: 'free', subscription_status: 'inactive', current_period_end: null }).eq('user_id', user.id);
      if (error) throw error;
      return json({ subscribed: false, tier: 'free', customerId: null });
    }
    const state = await syncCustomer(stripe, admin, customerId, user.id);
    return json({ subscribed: state.subscription_tier !== 'free', tier: state.subscription_tier, subscription_end: state.current_period_end, customerId });
  } catch (error) { return billingErrorResponse(error); }
});
