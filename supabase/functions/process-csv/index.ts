import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) throw new Error("Unauthorized");

    const { csv } = await req.json();
    
    // Parse CSV
    const lines = csv.split("\n").filter((line: string) => line.trim());
    const headers = lines[0].toLowerCase().split(",");
    
    const transactions = [];
    const subscriptionMap = new Map();

    // Process transactions
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const transaction: any = {};
      
      headers.forEach((header: string, index: number) => {
        transaction[header.trim()] = values[index]?.trim() || "";
      });

      // Extract transaction data (flexible for different bank formats)
      const date = transaction.date || transaction["transaction date"] || new Date().toISOString();
      const description = transaction.description || transaction.memo || transaction.narrative || "";
      const amount = parseFloat(transaction.amount || transaction["debit amount"] || transaction["credit amount"] || "0");
      
      if (!description || isNaN(amount)) continue;

      // Categorize transaction
      const category = categorizeTransaction(description);
      
      // Detect recurring subscriptions
      const isSubscription = detectSubscription(description);
      
      transactions.push({
        user_id: user.id,
        date: new Date(date).toISOString().split('T')[0],
        description,
        amount: Math.abs(amount),
        category,
        is_recurring: isSubscription,
        recurring_frequency: isSubscription ? "monthly" : null,
        merchant: extractMerchant(description),
      });

      // Track potential subscriptions
      if (isSubscription) {
        const merchant = extractMerchant(description);
        if (!subscriptionMap.has(merchant)) {
          subscriptionMap.set(merchant, {
            service_name: merchant,
            amount: Math.abs(amount),
            frequency: "monthly",
            last_charged: new Date(date).toISOString().split('T')[0],
            estimated_annual_cost: Math.abs(amount) * 12,
            cancellation_url: null,
            status: "active",
          });
        }
      }
    }

    // Insert transactions
    const { error: transError } = await supabaseClient
      .from("transactions")
      .insert(transactions);

    if (transError) throw transError;

    // Insert detected subscriptions
    const subscriptions = Array.from(subscriptionMap.values()).map(sub => ({
      ...sub,
      user_id: user.id,
    }));

    const { error: subError } = await supabaseClient
      .from("detected_subscriptions")
      .insert(subscriptions);

    if (subError) throw subError;

    return new Response(
      JSON.stringify({
        transactionsCount: transactions.length,
        subscriptionsCount: subscriptions.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

function categorizeTransaction(description: string): string {
  const lower = description.toLowerCase();
  
  if (lower.includes("rent") || lower.includes("mortgage")) return "Rent";
  if (lower.includes("grocery") || lower.includes("tesco") || lower.includes("sainsbury") || lower.includes("asda")) return "Groceries";
  if (lower.includes("netflix") || lower.includes("spotify") || lower.includes("disney") || lower.includes("prime")) return "Entertainment";
  if (lower.includes("gym") || lower.includes("fitness")) return "Fitness";
  if (lower.includes("restaurant") || lower.includes("cafe") || lower.includes("takeaway")) return "Dining";
  if (lower.includes("transport") || lower.includes("uber") || lower.includes("train")) return "Transport";
  
  return "Other";
}

function detectSubscription(description: string): boolean {
  const subscriptionKeywords = [
    "netflix", "spotify", "amazon prime", "disney", "apple music",
    "youtube premium", "hbo", "gym", "fitness", "subscription",
    "monthly", "annual", "membership"
  ];
  
  const lower = description.toLowerCase();
  return subscriptionKeywords.some(keyword => lower.includes(keyword));
}

function extractMerchant(description: string): string {
  // Remove common transaction codes and extract merchant name
  const cleaned = description
    .replace(/\d{2}\/\d{2}\/\d{2,4}/g, "")
    .replace(/[A-Z]{2,3}\s\d+/g, "")
    .trim();
  
  return cleaned.substring(0, 50);
}