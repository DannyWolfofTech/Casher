import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { buildSubscriptions, parseTransactionsCsv } from "../_shared/csv-parser.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const respond = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
export async function handleImport(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ code: "METHOD_NOT_ALLOWED", message: "Use POST to import a statement." }, 405);
  try {
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return respond({ code: "UNAUTHORIZED", message: "Sign in to upload a statement." }, 401);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return respond({ code: "UNAUTHORIZED", message: "Your session expired. Please sign in again." }, 401);
    const payload = await req.json();
    if (typeof payload?.csv !== "string" || !payload.csv.trim()) return respond({ code: "INVALID_PAYLOAD", message: "Choose a CSV statement to import." }, 422);
    if (new TextEncoder().encode(payload.csv).byteLength > 5 * 1024 * 1024) return respond({ code: "FILE_TOO_LARGE", message: "Choose a CSV smaller than 5 MB." }, 413);
    const parsed = parseTransactionsCsv(payload.csv, { maxRows: 10000 });
    if (parsed.ok === false) return respond({ code: parsed.code, message: parsed.message, details: parsed.details }, parsed.code === "TOO_MANY_ROWS" ? 413 : 422);
    const hashBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload.csv));
    const csvHash = Array.from(new Uint8Array(hashBytes)).map(b => b.toString(16).padStart(2, "0")).join("");
    const { data, error } = await supabase.rpc("import_statement_atomic", {
      _user_id: user.id, _csv_hash: csvHash, _transactions: parsed.transactions, _subscriptions: [...buildSubscriptions(parsed.transactions).values()],
    });
    if (error) {
      console.error("[process-csv] Atomic import failed", { code: error.code });
      return respond({ code: "IMPORT_UNAVAILABLE", message: "We could not confirm the import result. Retry the same file; completed imports will not be duplicated." }, 503);
    }
    const status = data.code === "QUOTA_EXCEEDED" ? 429 : data.code === "PROFILE_NOT_FOUND" ? 403 : 200;
    return respond({ ...data, skippedRows: parsed.skipped.length, skippedSample: parsed.skipped.slice(0, 5), duplicatesInFile: parsed.duplicatesInFile }, status);
  } catch (error) {
    if (error instanceof SyntaxError) return respond({ code: "INVALID_PAYLOAD", message: "The upload could not be read." }, 422);
    console.error("[process-csv] Request failed");
    // A transport failure may happen after the server committed: do not promise rollback.
    return respond({ code: "IMPORT_UNAVAILABLE", message: "We could not confirm the import result. Retry the same file; completed imports will not be duplicated." }, 503);
  }
}
serve(handleImport);
