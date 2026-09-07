import { isServiceRequest } from '../_shared/service-auth.ts';
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Internal monitoring endpoint: service-role callers only. verify_jwt=true
  // validates the token at the gateway; this compares the server-held credential.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!await isServiceRequest(req, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
      .select('event_id,event_type,created_at')
      .eq("processing_status", "failed")
      .gte("created_at", since)
      .order("created_at", { ascending: false }).limit(100);

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
    if (totalCount === null || succeededCount === null) throw new Error('Webhook counts unavailable');
    const stale = await supabaseAdmin.rpc('stale_billing_count');
    if (stale.error) throw new Error('Billing health unavailable');
    const hasFailures = failedCount > 0 || stale.data > 0;
    let alertQueued = false;
    if (hasFailures) {
      const alert = await supabaseAdmin.rpc('queue_maintenance_alert');
      if (alert.error) throw new Error('Maintenance alert unavailable');
      alertQueued = alert.data === true;
    }

    console.log(`[check-failed-webhooks] Last 24h: ${totalCount} total, ${succeededCount} succeeded, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        alert: hasFailures,
        alert_queued: alertQueued,
        summary: {
          total: totalCount || 0,
          succeeded: succeededCount || 0,
          failed: failedCount,
          stale_billing_accounts: stale.data,
          period: "last_24_hours",
        },
        failed_events: failedEvents?.map((e) => ({
          event_id: e.event_id,
          event_type: e.event_type,
          created_at: e.created_at,
        })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Webhook health check could not complete");
    return new Response(JSON.stringify({ error: "Internal error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
