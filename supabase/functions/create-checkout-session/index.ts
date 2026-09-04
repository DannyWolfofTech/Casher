import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { isAllowedPriceId, safeReturnOrigin } from "../_shared/stripe-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    console.log("Starting checkout session creation");
    
    // Get custom Stripe key
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_CUSTOM");
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY_CUSTOM not found");
      throw new Error("Stripe configuration error");
    }
    console.log("Custom Stripe key found");

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Authenticating user");
    
    const { data, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      console.error("User auth error:", userError);
      throw new Error("Authentication failed: " + userError.message);
    }
    
    const user = data.user;
    if (!user?.email) {
      console.error("No user or email found");
      throw new Error("User not authenticated or email not available");
    }
    console.log("User authenticated:", user.email);

    // Parse request body
    const requestBody = await req.json();
    console.log("Request body:", JSON.stringify(requestBody));
    
    const { priceId } = requestBody;
    if (!priceId) {
      console.error("No priceId provided");
      throw new Error("Price ID is required");
    }

    // Fail closed: only prices we actually sell may be checked out.
    if (!isAllowedPriceId(priceId)) {
      console.error("Rejected unknown priceId");
      return new Response(JSON.stringify({ error: "Unknown plan" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Initialize Stripe with custom key
    const stripe = new Stripe(stripeKey, { 
      httpClient: Stripe.createFetchHttpClient() 
    });
    console.log("Stripe client initialized");

    // Check for existing customer
    console.log("Checking for existing customer");
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;
    console.log("Customer ID:", customerId || "none found");

    // Get origin for redirect URLs
    const origin = safeReturnOrigin(
      req.headers.get("origin") || req.headers.get("referer"),
      Deno.env.get("ALLOWED_REDIRECT_ORIGINS"),
    );
    console.log("Using origin:", origin);

    // Create checkout session
    console.log("Creating checkout session");
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      metadata: { 
        user_id: user.id,
        user_email: user.email
      },
    });
    console.log("Checkout session created:", session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Checkout error:", {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
    return new Response(JSON.stringify({ 
      error: error.message
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
