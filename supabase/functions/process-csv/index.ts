import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  mapRowToTransaction,
  type ProcessedTransactionRecord,
  type RawTransactionRow,
} from "./utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SubscriptionInsert = {
  service_name: string;
  amount: number;
  frequency: "monthly";
  last_charged: string;
  estimated_annual_cost: number;
  cancellation_url: string | null;
  status: "active";
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
    const df = parsed.data as RawTransactionRow[];

    if (df.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid transactions found" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const transactions: ProcessedTransactionRecord[] = [];
    const subscriptionMap = new Map<string, SubscriptionInsert>();

    // Process transactions with per-row error handling
    df.forEach((row, index) => {
      try {
        const result = mapRowToTransaction(row, user.id);

        if (result === null) {
          return; // Skip invalid rows, not whole file
        }

        const { transaction, merchant, subscriptionAmount } = result;

        transactions.push(transaction);

        // Track subscriptions
        if (transaction.is_recurring && !subscriptionMap.has(merchant)) {
          subscriptionMap.set(merchant, {
            service_name: merchant,
            amount: subscriptionAmount,
            frequency: "monthly",
            last_charged: transaction.date,
            estimated_annual_cost: subscriptionAmount * 12,
            cancellation_url: null,
            status: "active",
          });
        }
      } catch (rowError) {
        console.log(`Row ${index} error: ${rowError}`); // Log bad rows, don't crash
      }
    });

    // Insert transactions
    if (transactions.length > 0) {
      const { error: transError } = await supabaseClient
        .from("transactions")
        .insert(transactions);

      if (transError) throw transError;
    }

    // Insert detected subscriptions
    const subscriptions = Array.from(subscriptionMap.values()).map((sub) => ({
      ...sub,
      user_id: user.id,
    }));

    if (subscriptions.length > 0) {
      const { error: subError } = await supabaseClient
        .from("detected_subscriptions")
        .insert(subscriptions);

      if (subError) throw subError;
    }

    return new Response(
      JSON.stringify({
        transactionsCount: transactions.length,
        subscriptionsCount: subscriptions.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});