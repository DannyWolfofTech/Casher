import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { PRICE_ID_TO_TIER } from "../_shared/stripe-tiers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  let eventId = "unknown";
  let eventType = "unknown";

  try {
    console.log("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_CUSTOM");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    console.log("Using Webhook Secret starting with:", webhookSecret ? webhookSecret.substring(0, 5) : "MISSING");

    if (!stripeKey || !webhookSecret) {
      console.error("Missing required environment variables");
      throw new Error("Configuration error");
    }

    const stripe = new Stripe(stripeKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.error("No signature found");
      throw new Error("No signature");
    }

    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log("Webhook signature verified:", event.type);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      // Log failed signature verification
      await supabaseAdmin.from("webhook_events").insert({
        event_id: `sig_fail_${Date.now()}`,
        event_type: "signature_verification_failed",
        processing_status: "failed",
        error_message: err.message,
        payload: { signature_present: !!signature },
      });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    eventId = event.id;
    eventType = event.type;

    // Log the received event
    await supabaseAdmin.from("webhook_events").insert({
      event_id: eventId,
      event_type: eventType,
      processing_status: "processing",
      payload: { metadata: (event.data.object as any)?.metadata },
    });

    // Handle the checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("Processing checkout session:", session.id);

      const userId = session.metadata?.user_id;
      if (!userId) {
        console.error("No user_id in session metadata");
        throw new Error("No user_id found");
      }

      const subscriptionId = session.subscription as string;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      const priceId = subscription.items.data[0].price.id;
      console.log("Price ID:", priceId);

      let tier = PRICE_ID_TO_TIER[priceId] || "free";
      console.log("Determined tier:", tier);

      const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          subscription_tier: tier,
          subscription_status: "active",
          current_period_end: currentPeriodEnd,
          stripe_customer_id: session.customer as string,
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Error updating profile:", updateError);
        throw updateError;
      }

      console.log("Profile updated successfully for user:", userId);
    }

    // Mark event as succeeded
    await supabaseAdmin
      .from("webhook_events")
      .update({ processing_status: "succeeded", processed_at: new Date().toISOString() })
      .eq("event_id", eventId);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error.message);

    // Mark event as failed
    await supabaseAdmin
      .from("webhook_events")
      .update({
        processing_status: "failed",
        error_message: error.message,
        processed_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
