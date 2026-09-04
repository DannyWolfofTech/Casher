import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  buildSubscriptions,
  dedupKey,
  IMPORT_VERSION,
  legacyDedupKey,
  parseTransactionsCsv,
  type NormalizedTransaction,
} from "../_shared/csv-parser.ts";
import {
  quotaExceededMessage,
  releaseUploadSlot,
  reserveUploadSlot,
  type ReservationResult,
} from "../_shared/quota.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 10_000;
const INSERT_CHUNK = 500;
/** A re-upload of the identical file inside this window is treated as a replay. */
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

type Json = Record<string, unknown>;

function json(body: Json, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function fail(code: string, message: string, status: number, extra: Json = {}) {
  return json({ ok: false, code, error: message, message, ...extra }, status);
}

function usagePayload(r: ReservationResult) {
  return {
    uploadsUsed: r.uploadsUsed,
    uploadLimit: r.uploadLimit,
    tier: r.tier,
    canUpload: r.uploadLimit === null || r.uploadsUsed < r.uploadLimit,
  };
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * True when Postgres/PostgREST rejected the call because the function or column
 * does not exist yet (the Phase A migration has not been applied).
 * 42883 = undefined_function, 42703 = undefined_column, PGRST202 = no such RPC.
 */
function isMissingDbObject(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code ?? "";
  const message = (e?.message ?? String(err ?? "")).toLowerCase();
  return (
    code === "42883" ||
    code === "42703" ||
    code === "PGRST202" ||
    code === "PGRST204" ||
    message.includes("does not exist") ||
    message.includes("could not find") ||
    message.includes("schema cache")
  );
}

/** Non-atomic server-side allowance check used only before the migration lands. */
async function fallbackReserve(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<ReservationResult> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, monthly_uploads_used, uploads_reset_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) {
    return { allowed: false, uploadsUsed: 0, uploadLimit: 0, tier: "free", reason: "profile_not_found" };
  }

  const tier = String(profile.subscription_tier ?? "free");
  const uploadLimit = tier === "free" ? 1 : null;

  // Calendar-month reset decided by SERVER time, never the browser clock.
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resetDate = profile.uploads_reset_date ? new Date(String(profile.uploads_reset_date)) : null;
  const stale = !resetDate || resetDate.getTime() < periodStart.getTime();
  const used = stale ? 0 : Number(profile.monthly_uploads_used ?? 0);

  if (uploadLimit !== null && used >= uploadLimit) {
    return { allowed: false, uploadsUsed: used, uploadLimit, tier, reason: "quota_exceeded" };
  }

  const next = used + 1;
  await supabase
    .from("profiles")
    .update({
      monthly_uploads_used: next,
      uploads_reset_date: periodStart.toISOString().slice(0, 10),
    })
    .eq("user_id", userId);

  return { allowed: true, uploadsUsed: next, uploadLimit, tier, reason: null };
}

/** Fallback release for the pre-migration path. */
async function fallbackRelease(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("monthly_uploads_used")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return false;
  const next = Math.max(Number(profile.monthly_uploads_used ?? 0) - 1, 0);
  const { error } = await supabase
    .from("profiles")
    .update({ monthly_uploads_used: next })
    .eq("user_id", userId);
  return !error;
}


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // ---------------------------------------------------------------- auth
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return fail("UNAUTHORIZED", "You must be signed in to upload a statement.", 401);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return fail("UNAUTHORIZED", "Your session has expired. Please sign in again.", 401);
  }

  // ------------------------------------------------------------- payload
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return fail("INVALID_PAYLOAD", "The request body was not valid JSON.", 422);
  }

  const csv = (payload as { csv?: unknown })?.csv;
  if (typeof csv !== "string" || csv.trim() === "") {
    return fail("INVALID_PAYLOAD", "No CSV content was received.", 422);
  }

  const csvBytes = new TextEncoder().encode(csv).byteLength;
  if (csvBytes > MAX_CSV_BYTES) {
    return fail(
      "FILE_TOO_LARGE",
      `This file is ${(csvBytes / (1024 * 1024)).toFixed(1)} MB, over the ${
        MAX_CSV_BYTES / (1024 * 1024)
      } MB limit. Please split it into smaller files.`,
      413,
      { details: { bytes: csvBytes, maxBytes: MAX_CSV_BYTES } },
    );
  }

  // --------------------------------------------------------------- parse
  const parsed = parseTransactionsCsv(csv, { maxRows: MAX_ROWS });
  if (!parsed.ok) {
    const status = parsed.code === "TOO_MANY_ROWS" ? 413 : 422;
    return fail(parsed.code, parsed.message, status, { details: parsed.details ?? {} });
  }

  // --------------------------------------------------------- idempotency
  const csvHash = await sha256Hex(csv);
  const since = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS).toISOString();
  const { data: priorUploads } = await supabase
    .from("upload_history")
    .select("*")
    .eq("user_id", user.id)
    .eq("csv_hash", csvHash)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);

  const prior = priorUploads?.[0];
  if (prior) {
    // Same file, same user, recently processed: do NOT consume another slot
    // and do NOT write a second history row. Report current usage read-only.
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("subscription_tier, monthly_uploads_used")
      .eq("user_id", user.id)
      .maybeSingle();

    const tier = String(profileRow?.subscription_tier ?? "free");
    const uploadLimit = tier === "free" ? 1 : null;
    const uploadsUsed = Number(profileRow?.monthly_uploads_used ?? 0);



    return json({
      ok: true,
      code: "REPLAY",
      replay: true,
      transactionsCount: 0,
      subscriptionsCount: 0,
      subscriptionsUpdated: 0,
      duplicatesSkipped: parsed.transactions.length,
      duplicatesInFile: parsed.duplicatesInFile,
      skippedRows: parsed.skipped.length,
      batchSpending: Number(prior.total_spending ?? 0),
      batchCredits: Number(prior.total_credits ?? 0),
      batchSubsCount: Number(prior.subscriptions_count ?? 0),
      batchAnnualSavings: Number(prior.potential_savings ?? 0),
      message: "You already uploaded this exact file recently — nothing was imported again.",
      usage: {
        uploadsUsed,
        uploadLimit,
        tier,
        canUpload: uploadLimit === null || uploadsUsed < uploadLimit,
      },

    }, 200);
  }

  // ------------------------------------------------------- reserve quota
  //
  // The strict path is reserve_upload_slot (row-locked, database time). Until
  // that function exists in the database, fall back to a non-atomic read of the
  // profile so uploads keep working; the fallback is still SERVER-side.
  let reservation: ReservationResult;
  let usedFallbackQuota = false;
  try {
    reservation = await reserveUploadSlot(supabase, user.id);
  } catch (err) {
    if (!isMissingDbObject(err)) {
      console.error("[process-csv] reserve_upload_slot failed", err);
      return fail("QUOTA_UNAVAILABLE", "We could not verify your upload allowance. Please try again.", 500);
    }
    console.warn("[process-csv] reserve_upload_slot missing — using fallback quota check");
    usedFallbackQuota = true;
    reservation = await fallbackReserve(supabase, user.id);
  }


  if (!reservation.allowed) {
    // SQL returns lowercase reasons; compare case-insensitively.
    if ((reservation.reason ?? "").toLowerCase() === "profile_not_found") {
      return fail("PROFILE_NOT_FOUND", "We could not find your account profile.", 403, {
        usage: usagePayload(reservation),
      });
    }
    return fail("QUOTA_EXCEEDED", quotaExceededMessage(reservation), 429, {
      usage: usagePayload(reservation),
    });
  }


  // ----------------------------------------------------------- do the work
  try {
    const uniqueDates = [...new Set(parsed.transactions.map((t) => t.date))];

    const existingRows: Array<{ date: string; description: string; amount: number; direction: string | null }> = [];
    // `direction` may not exist yet (pre-migration); fall back to a plain select.
    let selectCols = "date, description, amount, direction";
    for (const dateChunk of chunk(uniqueDates, 200)) {
      let { data, error } = await supabase
        .from("transactions")
        .select(selectCols)
        .eq("user_id", user.id)
        .in("date", dateChunk);
      if (error && isMissingDbObject(error)) {
        selectCols = "date, description, amount";
        ({ data, error } = await supabase
          .from("transactions")
          .select(selectCols)
          .eq("user_id", user.id)
          .in("date", dateChunk));
      }
      if (error) throw error;
      existingRows.push(
        ...((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
          date: String(r.date),
          description: String(r.description),
          amount: Number(r.amount),
          direction: (r.direction as string | null) ?? null,
        })),
      );
    }


    // Sign-preserving keys for modern rows; absolute-value keys for legacy
    // rows (import_version < 2) which were stored without a direction.
    const existingSigned = new Set<string>();
    const existingLegacyAbs = new Set<string>();
    for (const row of existingRows) {
      existingSigned.add(dedupKey(row.date, row.description, Number(row.amount)));
      if (row.direction === null || row.direction === undefined) {
        existingLegacyAbs.add(legacyDedupKey(row.date, row.description, Number(row.amount)));
      }
    }

    const fresh: NormalizedTransaction[] = parsed.transactions.filter((t) => {
      if (existingSigned.has(dedupKey(t.date, t.description, t.amount))) return false;
      // A legacy row stored as +12.99 represents the same debit as -12.99 now.
      if (
        t.direction === "debit" &&
        existingLegacyAbs.has(legacyDedupKey(t.date, t.description, t.amount))
      ) return false;
      return true;
    });

    const duplicatesSkipped = parsed.transactions.length - fresh.length;

    let insertedTxnCount = 0;
    if (fresh.length > 0) {
      const rows = fresh.map((t) => ({
        user_id: user.id,
        date: t.date,
        description: t.description,
        amount: t.amount, // signed
        direction: t.direction,
        import_version: IMPORT_VERSION,
        category: t.category,
        is_recurring: t.isSubscription,
        recurring_frequency: t.isSubscription ? "monthly" : null,
        merchant: t.merchant,
      }));

      for (const part of chunk(rows, INSERT_CHUNK)) {
        const { error } = await supabase.from("transactions").insert(part);
        if (error) {
          if (!isMissingDbObject(error)) throw error;
          // Pre-migration: no direction/import_version columns. Write the
          // legacy shape (unsigned magnitude) so existing screens keep working.
          const legacyPart = part.map(({ direction: _d, import_version: _v, ...rest }) => ({
            ...rest,
            amount: Math.abs(Number(rest.amount)),
          }));
          const { error: legacyError } = await supabase.from("transactions").insert(legacyPart);
          if (legacyError) throw legacyError;
        }
        insertedTxnCount += part.length;
      }
    }


    // Subscriptions are derived from DEBITS only.
    const subscriptionMap = buildSubscriptions(fresh);
    const subNames = Array.from(subscriptionMap.keys());

    const { data: existingSubs, error: subFetchError } = await supabase
      .from("detected_subscriptions")
      .select("id, service_name, amount")
      .eq("user_id", user.id)
      .in("service_name", subNames.length > 0 ? subNames : ["__none__"]);
    if (subFetchError) throw subFetchError;

    const existingSubByName = new Map(
      (existingSubs ?? []).map((s: { id: string; service_name: string; amount: number }) => [s.service_name, s]),
    );

    const subsToInsert: Array<Record<string, unknown>> = [];
    let subsUpdated = 0;

    for (const sub of subscriptionMap.values()) {
      const existing = existingSubByName.get(sub.service_name);
      if (!existing) {
        subsToInsert.push({ ...sub, user_id: user.id });
      } else if (Math.abs(Number(existing.amount) - Number(sub.amount)) > 0.005) {
        const { error: updErr } = await supabase
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
      const { error: subError } = await supabase
        .from("detected_subscriptions")
        .insert(subsToInsert);
      if (subError) throw subError;
    }

    // Per-batch totals: spending is the magnitude of debits only.
    const batchSpending = fresh
      .filter((t) => t.direction === "debit")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const batchCredits = fresh
      .filter((t) => t.direction === "credit")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const batchAnnualSavings = subsToInsert.reduce(
      (sum, s) => sum + Number(s.estimated_annual_cost ?? 0),
      0,
    );
    const batchSubsCount = subsToInsert.length + subsUpdated;

    // Upload history is written SERVER-SIDE only, after the work succeeded.
    const { error: historyError } = await supabase.from("upload_history").insert({
      user_id: user.id,
      total_spending: Number(batchSpending.toFixed(2)),
      total_credits: Number(batchCredits.toFixed(2)),
      subscriptions_count: batchSubsCount,
      potential_savings: Number(batchAnnualSavings.toFixed(2)),
      transaction_count: insertedTxnCount,
      csv_hash: csvHash,
    });
    if (historyError) throw historyError;

    return json({
      ok: true,
      code: "OK",
      replay: false,
      transactionsCount: insertedTxnCount,
      subscriptionsCount: subsToInsert.length,
      subscriptionsUpdated: subsUpdated,
      duplicatesSkipped,
      duplicatesInFile: parsed.duplicatesInFile,
      skippedRows: parsed.skipped.length,
      skippedSample: parsed.skipped.slice(0, 5),
      batchSpending: Number(batchSpending.toFixed(2)),
      batchCredits: Number(batchCredits.toFixed(2)),
      batchSubsCount,
      batchAnnualSavings: Number(batchAnnualSavings.toFixed(2)),
      usage: usagePayload(reservation),
    }, 200);
  } catch (error) {
    // Compensate: the slot was reserved but the work failed.
    const released = await releaseUploadSlot(supabase, user.id);
    console.error("[process-csv] processing failed", { released, error });
    return fail(
      "PROCESSING_FAILED",
      "We couldn't finish importing your statement. Your upload allowance was not used — please try again.",
      500,
      { released },
    );
  }
});
