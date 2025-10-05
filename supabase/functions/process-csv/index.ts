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

    // Parse CSV with PapaParse (Deno-compatible)
    const { default: Papa } = await import('https://esm.sh/papaparse@5.4.1');
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    const df = parsed.data as any[];

 if (df.length === 0) {
   return new Response(JSON.stringify({ error: 'No valid transactions found' }), { 
     headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
     status: 400 
   });
 }

 const transactions: any[] = [];
 const subscriptionMap = new Map<string, any>();

 // Process transactions with per-row error handling
 df.forEach((transaction: any, index: number) => {
   try {
     // Extract data (flexible for different bank formats)
     const date = transaction.date || transaction['transaction date'] || new Date().toISOString();
     const description = transaction.description || transaction.memo || transaction.narrative || '';
     const rawAmount = transaction.amount || transaction['debit amount'] || transaction['credit amount'] || '0';
     const amount = parseFloat(rawAmount.replace(/[^0-9.-]/g, '')) || 0;  // Clean numbers, handle negatives

     if (!description || isNaN(amount)) return;  // Skip invalid rows, not whole file

     // Parse date (UK format to ISO)
     const dateMatch = date.match(/(\d{2})\/(\d{2})\/(\d{4})/);
     const parsedDate = dateMatch ? new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`) : new Date(date);
     const dateStr = parsedDate.toISOString().split('T')[0];

     // Categorize and detect
     const category = categorizeTransaction(description);
     const isSubscription = detectSubscription(description);
     const merchant = extractMerchant(description);

     transactions.push({
       user_id: user.id,
       date: dateStr,
       description,
       amount: Math.abs(amount),
       category,
       is_recurring: isSubscription,
       recurring_frequency: isSubscription ? 'monthly' : null,
       merchant,
     });

     // Track subscriptions
     if (isSubscription) {
       if (!subscriptionMap.has(merchant)) {
         subscriptionMap.set(merchant, {
           service_name: merchant,
           amount: Math.abs(amount),
           frequency: 'monthly',
           last_charged: dateStr,
           estimated_annual_cost: Math.abs(amount) * 12,
           cancellation_url: null,
           status: 'active',
         });
       }
     }
   } catch (rowError) {
     console.log(`Row ${index} error: ${rowError}`);  // Log bad rows, don't crash
   }
 });

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