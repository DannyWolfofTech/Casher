import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input limits
const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 10_000;

// Parse a UK-format date string (DD/MM/YYYY or DD-MM-YYYY) into ISO YYYY-MM-DD.
// Also supports YYYY-MM-DD pass-through. Returns null if unparseable.
function parseUkDate(input: string): string | null {
  if (!input) return null;
  const s = input.trim();

  // Already ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const y = iso[1], m = iso[2].padStart(2, "0"), d = iso[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // UK DD/MM/YYYY or DD-MM-YYYY (also handles single-digit day/month, 2-digit year)
  const uk = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (uk) {
    let [, d, m, y] = uk;
    if (y.length === 2) y = (parseInt(y, 10) >= 70 ? "19" : "20") + y;
    const dd = d.padStart(2, "0");
    const mm = m.padStart(2, "0");
    // Validate ranges
    const dn = parseInt(dd, 10), mn = parseInt(mm, 10);
    if (dn < 1 || dn > 31 || mn < 1 || mn > 12) return null;
    return `${y}-${mm}-${dd}`;
  }

  return null;
}

// Parse currency amount that may include £/$/€ symbols, thousands separators,
// and either UK (1,234.56) or European (1.234,56) decimal conventions.
function parseAmount(input: string): number {
  if (!input) return NaN;
  let s = String(input).trim();
  // Strip currency symbols and spaces
  s = s.replace(/[£$€\s]/g, "");
  // Handle parentheses as negative: (123.45) -> -123.45
  const negParen = /^\((.*)\)$/.exec(s);
  if (negParen) s = "-" + negParen[1];

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Whichever appears LAST is the decimal separator
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // European: 1.234,56 -> 1234.56
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // UK/US: 1,234.56 -> 1234.56
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Only commas. If exactly one comma followed by 1-2 digits => decimal. Otherwise thousands.
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      s = parts[0] + "." + parts[1];
    } else {
      s = s.replace(/,/g, "");
    }
  }
  // Strip any remaining non-numeric chars except sign and dot
  s = s.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

function normalizeDescription(d: string): string {
  return (d || "").trim().toLowerCase().replace(/\s+/g, " ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const { csv } = await req.json();

    if (typeof csv !== "string") {
      return new Response(JSON.stringify({ error: "Invalid CSV payload." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Size limit (UTF-8 byte length)
    const csvBytes = new TextEncoder().encode(csv).byteLength;
    if (csvBytes > MAX_CSV_BYTES) {
      return new Response(
        JSON.stringify({
          error: `CSV exceeds the ${Math.round(MAX_CSV_BYTES / (1024 * 1024))} MB limit. Please split your file.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 413 }
      );
    }

    // Parse CSV with PapaParse (Deno-compatible)
    const { default: Papa } = await import("https://esm.sh/papaparse@5.4.1");
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    const df = parsed.data as any[];

    if (df.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Could not find headers. Please ensure your CSV has 'Date', 'Description', and 'Amount' columns.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (df.length > MAX_ROWS) {
      return new Response(
        JSON.stringify({ error: `CSV has too many rows (max ${MAX_ROWS}). Please split your file.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 413 }
      );
    }

    const getFieldValue = (row: any, fieldNames: string[]): string => {
      for (const field of fieldNames) {
        if (row[field] !== undefined) return String(row[field]);
        const lowerField = field.toLowerCase();
        for (const key of Object.keys(row)) {
          if (key.toLowerCase() === lowerField) return String(row[key]);
        }
      }
      return "";
    };

    const transactions: any[] = [];
    const subscriptionMap = new Map<string, any>();

    df.forEach((transaction: any, index: number) => {
      try {
        const date = getFieldValue(transaction, ["date", "transaction date", "posted date", "trans date"]);
        const description = getFieldValue(transaction, [
          "description", "transaction description", "memo", "narrative", "details", "reference",
        ]);
        const rawAmount = getFieldValue(transaction, [
          "amount", "cost", "value", "debit amount", "credit amount", "sum",
        ]);

        const amount = parseAmount(rawAmount);
        if (!description || isNaN(amount) || amount === 0) return;

        const dateStr = parseUkDate(date);
        if (!dateStr) return;

        const category = categorizeTransaction(description);
        const isSubscription = detectSubscription(description);
        const merchant = extractMerchant(description);
        const absAmount = Math.abs(amount);

        transactions.push({
          user_id: user.id,
          date: dateStr,
          description,
          amount: absAmount,
          category,
          is_recurring: isSubscription,
          recurring_frequency: isSubscription ? "monthly" : null,
          merchant,
        });

        if (isSubscription) {
          if (!subscriptionMap.has(merchant)) {
            subscriptionMap.set(merchant, {
              service_name: merchant,
              amount: absAmount,
              frequency: "monthly",
              last_charged: dateStr,
              estimated_annual_cost: absAmount * 12,
              cancellation_url: null,
              status: "active",
            });
          }
        }
      } catch (rowError) {
        console.log(`Row ${index} error: ${rowError}`);
      }
    });

    if (transactions.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Could not find headers. Please ensure your CSV has 'Date', 'Description', and 'Amount' columns.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Deduplicate using normalized keys (date | normalized description | abs amount)
    const uniqueDates = [...new Set(transactions.map((t) => t.date))];
    const { data: existingTxns, error: fetchError } = await supabaseClient
      .from("transactions")
      .select("date, description, amount")
      .eq("user_id", user.id)
      .in("date", uniqueDates);

    if (fetchError) throw fetchError;

    const dedupKey = (date: string, desc: string, amt: number | string) =>
      `${date}|${normalizeDescription(String(desc))}|${Math.abs(Number(amt)).toFixed(2)}`;

    const existingKeys = new Set(
      (existingTxns || []).map((t) => dedupKey(t.date, t.description, t.amount))
    );

    const newTransactions = transactions.filter(
      (t) => !existingKeys.has(dedupKey(t.date, t.description, t.amount))
    );

    const skippedCount = transactions.length - newTransactions.length;
    if (skippedCount > 0) console.log(`Skipped ${skippedCount} duplicate transactions`);

    let insertedTxnCount = 0;
    if (newTransactions.length > 0) {
      const { error: transError } = await supabaseClient
        .from("transactions")
        .insert(newTransactions);
      if (transError) throw transError;
      insertedTxnCount = newTransactions.length;
    }

    // Subscriptions: upsert when amount changed, insert when new
    const subNames = Array.from(subscriptionMap.keys());
    const { data: existingSubs } = await supabaseClient
      .from("detected_subscriptions")
      .select("id, service_name, amount")
      .eq("user_id", user.id)
      .in("service_name", subNames.length > 0 ? subNames : ["__none__"]);

    const existingSubByName = new Map(
      (existingSubs || []).map((s) => [s.service_name, s])
    );

    const subsToInsert: any[] = [];
    let subsUpdated = 0;

    for (const sub of subscriptionMap.values()) {
      const existing = existingSubByName.get(sub.service_name);
      if (!existing) {
        subsToInsert.push({ ...sub, user_id: user.id });
      } else if (Math.abs(Number(existing.amount) - Number(sub.amount)) > 0.005) {
        // Amount changed — update price + annual cost + last charged
        const { error: updErr } = await supabaseClient
          .from("detected_subscriptions")
          .update({
            amount: sub.amount,
            estimated_annual_cost: sub.estimated_annual_cost,
            last_charged: sub.last_charged,
          })
          .eq("id", existing.id);
        if (updErr) throw updErr;
        subsUpdated += 1;
      }
    }

    if (subsToInsert.length > 0) {
      const { error: subError } = await supabaseClient
        .from("detected_subscriptions")
        .insert(subsToInsert);
      if (subError) throw subError;
    }

    // Compute per-batch totals for the just-uploaded data (used by upload_history)
    const batchSpending = newTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const batchAnnualSavings =
      subsToInsert.reduce((sum, s) => sum + Number(s.estimated_annual_cost || 0), 0);
    const batchSubsCount = subsToInsert.length + subsUpdated;

    return new Response(
      JSON.stringify({
        transactionsCount: insertedTxnCount,
        subscriptionsCount: subsToInsert.length,
        subscriptionsUpdated: subsUpdated,
        duplicatesSkipped: skippedCount,
        batchSpending,
        batchSubsCount,
        batchAnnualSavings,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

function categorizeTransaction(description: string): string {
  const lower = description.toLowerCase();
  if (
    lower.includes("netflix") || lower.includes("spotify") || lower.includes("disney") ||
    lower.includes("prime") || lower.includes("youtube premium") || lower.includes("apple music") ||
    lower.includes("hbo") || lower.includes("subscription")
  ) return "Subscription";
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
    "monthly", "annual", "membership",
  ];
  const lower = description.toLowerCase();
  return subscriptionKeywords.some((keyword) => lower.includes(keyword));
}

function extractMerchant(description: string): string {
  const cleaned = description
    .replace(/\d{2}\/\d{2}\/\d{2,4}/g, "")
    .replace(/[A-Z]{2,3}\s\d+/g, "")
    .trim();
  return cleaned.substring(0, 50);
}
