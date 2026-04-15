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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get failed webhooks from the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: failedEvents, error } = await supabaseAdmin
      .from("webhook_events")
      .select("*")
      .eq("processing_status", "failed")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const { count: totalCount } = await supabaseAdmin
      .from("webhook_events")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since);

    const { count: succeededCount } = await supabaseAdmin
      .from("webhook_events")
      .select("*", { count: "exact", head: true })
      .eq("processing_status", "succeeded")
      .gte("created_at", since);

    const failedCount = failedEvents?.length || 0;
    const hasFailures = failedCount > 0;

    console.log(`[check-failed-webhooks] Last 24h: ${totalCount} total, ${succeededCount} succeeded, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        alert: hasFailures,
        summary: {
          total: totalCount || 0,
          succeeded: succeededCount || 0,
          failed: failedCount,
          period: "last_24_hours",
        },
        failed_events: failedEvents?.map((e) => ({
          event_id: e.event_id,
          event_type: e.event_type,
          error_message: e.error_message,
          created_at: e.created_at,
        })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error checking failed webhooks:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
