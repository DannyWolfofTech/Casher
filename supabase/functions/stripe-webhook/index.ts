import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@18.5.0';
import { billingClients, json, syncCustomer } from '../_shared/billing.ts';

serve(async req => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  let eventId: string | undefined;
  try {
    const { stripe, admin } = billingClients();
    const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new Error('Webhook unavailable');
    const signature = req.headers.get('stripe-signature');
    if (!signature) return json({ error: 'Invalid signature.' }, 400);
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(await req.text(), signature, secret, undefined, Stripe.createSubtleCryptoProvider());
    } catch {
      // Unverified requests must not manufacture database audit rows or expose secrets.
      return json({ error: 'Invalid signature.' }, 400);
    }
    eventId = event.id;
    const { error: logError } = await admin.from('webhook_events').upsert({
      event_id: event.id, event_type: event.type, processing_status: 'processing', payload: {},
    }, { onConflict: 'event_id' });
    if (logError) throw logError;
    let customerId: string | null = null;
    let userId: string | undefined;
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription') {
        customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
        userId = session.metadata?.user_id;
      }
    } else if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      const subscription = event.data.object as Stripe.Subscription;
      customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
      userId = subscription.metadata?.user_id;
    } else if (['invoice.payment_failed', 'invoice.payment_succeeded', 'invoice.paid'].includes(event.type)) {
      const invoice = event.data.object as Stripe.Invoice;
      customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
    }
    // Read Stripe's current state instead of replaying old event snapshots. This is
    // idempotent, handles invoice schema versions and preserves any other active plan.
    if (customerId) await syncCustomer(stripe, admin, customerId, userId);
    const { error } = await admin.from('webhook_events').update({ processing_status: 'succeeded', processed_at: new Date().toISOString(), error_message: null }).eq('event_id', event.id);
    if (error) throw error;
    return json({ received: true });
  } catch {
    console.error('[stripe-webhook] Reconciliation failed', { eventId });
    if (eventId) {
      try {
        const { admin } = billingClients();
        await admin.from('webhook_events').update({ processing_status: 'failed', error_message: 'Billing reconciliation failed; retry this event.', processed_at: new Date().toISOString() }).eq('event_id', eventId);
      } catch { /* Stripe receives a failure and retries even if logging is down. */ }
    }
    return json({ error: 'Billing reconciliation failed. Please retry.' }, 500);
  }
});
