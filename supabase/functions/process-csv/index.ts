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
    return new Response(JSON.stringify({ error: "Could not find headers. Please ensure your CSV has 'Date', 'Description', and 'Amount' columns." }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    });
  }

  // Helper function to get value case-insensitively
  const getFieldValue = (row: any, fieldNames: string[]): string => {
    for (const field of fieldNames) {
      // Check exact match first
      if (row[field] !== undefined) return String(row[field]);
      // Check case-insensitive
      const lowerField = field.toLowerCase();
      for (const key of Object.keys(row)) {
        if (key.toLowerCase() === lowerField) return String(row[key]);
      }
    }
    return '';
  };

  const transactions: any[] = [];
  const subscriptionMap = new Map<string, any>();

  // Process transactions with per-row error handling
  df.forEach((transaction: any, index: number) => {
    try {
      // Extract data (flexible for different bank formats - case-insensitive)
      const date = getFieldValue(transaction, ['date', 'Date', 'DATE', 'transaction date', 'Transaction Date', 'posted date', 'Posted Date', 'trans date', 'Trans Date']);
      const description = getFieldValue(transaction, ['description', 'Description', 'DESCRIPTION', 'transaction description', 'Transaction Description', 'memo', 'Memo', 'MEMO', 'narrative', 'Narrative', 'details', 'Details', 'reference', 'Reference']);
      const rawAmount = getFieldValue(transaction, ['amount', 'Amount', 'AMOUNT', 'cost', 'Cost', 'COST', 'value', 'Value', 'VALUE', 'debit amount', 'Debit Amount', 'credit amount', 'Credit Amount', 'sum', 'Sum']);
      
      const amount = parseFloat(rawAmount.replace(/[^0-9.-]/g, '')) || 0;

      if (!description || isNaN(amount) || amount === 0) return;  // Skip invalid rows, not whole file

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

  // Check if we found any valid transactions
  if (transactions.length === 0) {
    return new Response(JSON.stringify({ error: "Could not find headers. Please ensure your CSV has 'Date', 'Description', and 'Amount' columns." }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    });
  }

    // Deduplicate: fetch existing transactions for this user with matching dates
    const uniqueDates = [...new Set(transactions.map(t => t.date))];
    const { data: existingTxns, error: fetchError } = await supabaseClient
      .from("transactions")
      .select("date, description, amount")
      .eq("user_id", user.id)
      .in("date", uniqueDates);

    if (fetchError) throw fetchError;

    // Build a Set of "date|description|amount" keys for fast lookup
    const existingKeys = new Set(
      (existingTxns || []).map(t => `${t.date}|${t.description}|${t.amount}`)
    );

    const newTransactions = transactions.filter(
      t => !existingKeys.has(`${t.date}|${t.description}|${t.amount}`)
    );

    const skippedCount = transactions.length - newTransactions.length;
    if (skippedCount > 0) {
      console.log(`Skipped ${skippedCount} duplicate transactions`);
    }

    // Insert only new transactions
    if (newTransactions.length > 0) {
      const { error: transError } = await supabaseClient
        .from("transactions")
        .insert(newTransactions);
      if (transError) throw transError;
    }

    // Deduplicate subscriptions similarly
    const subNames = Array.from(subscriptionMap.keys());
    const { data: existingSubs } = await supabaseClient
      .from("detected_subscriptions")
      .select("service_name")
      .eq("user_id", user.id)
      .in("service_name", subNames.length > 0 ? subNames : ['__none__']);

    const existingSubNames = new Set((existingSubs || []).map(s => s.service_name));

    const subscriptions = Array.from(subscriptionMap.values())
      .filter(sub => !existingSubNames.has(sub.service_name))
      .map(sub => ({ ...sub, user_id: user.id }));

    if (subscriptions.length > 0) {
      const { error: subError } = await supabaseClient
        .from("detected_subscriptions")
        .insert(subscriptions);
      if (subError) throw subError;
    }

    return new Response(
      JSON.stringify({
        transactionsCount: newTransactions.length,
        subscriptionsCount: subscriptions.length,
        duplicatesSkipped: skippedCount,
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
  
  // Check for subscriptions first
  if (lower.includes("netflix") || lower.includes("spotify") || lower.includes("disney") || 
      lower.includes("prime") || lower.includes("youtube premium") || lower.includes("apple music") || 
      lower.includes("hbo") || lower.includes("subscription")) return "Subscription";
  
  if (lower.includes("rent") || lower.includes("mortgage")) return "Rent";
  if (lower.includes("grocery") || lower.includes("tesco") || lower.includes("sainsbury") || lower.includes("asda")) return "Groceries";
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