import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Webhook received");

    // Get environment variables
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_CUSTOM");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    console.log("Using Webhook Secret starting with:", webhookSecret ? webhookSecret.substring(0, 5) : "MISSING");
    
    if (!stripeKey || !webhookSecret) {
      console.error("Missing required environment variables");
      throw new Error("Configuration error");
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Initialize Supabase with service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get the signature from headers
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.error("No signature found");
      throw new Error("No signature");
    }

    // Get the raw body
    const body = await req.text();

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log("Webhook signature verified:", event.type);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle the checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("Processing checkout session:", session.id);

      // Get user_id from metadata
      const userId = session.metadata?.user_id;
      if (!userId) {
        console.error("No user_id in session metadata");
        throw new Error("No user_id found");
      }

      // Get the subscription details
      const subscriptionId = session.subscription as string;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      // Get the price ID to determine tier
      const priceId = subscription.items.data[0].price.id;
      console.log("Price ID:", priceId);

      // Map price ID to subscription tier
      let tier = "free";
      if (priceId === "price_1SYzJQJMS012Ip2AChBRKO5w") {
        tier = "pro";
      } else if (priceId === "price_1SYzKoJMS012Ip2Ask6ktJJi") {
        tier = "premium";
      }

      console.log("Determined tier:", tier);

      // Get current period end
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

      // Update user profile
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

    // Return success response to Stripe
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
