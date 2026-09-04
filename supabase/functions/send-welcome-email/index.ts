import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require an authenticated caller. The email is always taken from the
    // verified session, never from the request body, so this endpoint cannot
    // be used to send mail to arbitrary third-party addresses.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.slice("Bearer ".length).trim();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user?.email) {
      return json({ error: "Unauthorized" }, 401);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("send-welcome-email: RESEND_API_KEY is not configured");
      return json({ error: "Email sending is not available right now" }, 503);
    }

    const resend = new Resend(resendApiKey);
    const recipient = user.email;

    console.log("send-welcome-email: sending to authenticated user", user.id);

    const emailResponse = await resend.emails.send({
      from: "Casher <onboarding@resend.dev>",
      to: [recipient],
      subject: "Welcome to Casher!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #22c55e;">Welcome to Casher! 💰</h1>
          <p>Pro tips incoming! Upload your first CSV to spot subscriptions and start saving.</p>
          <p><strong>Here's how to get started:</strong></p>
          <ol>
            <li>Export your bank statement as CSV (works with HSBC, NatWest, Barclays)</li>
            <li>Upload it to your dashboard</li>
            <li>We'll automatically detect recurring subscriptions</li>
            <li>See how much you can save annually!</li>
          </ol>
          <p>Need help? Just reply to this email.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Best regards,<br>The Casher Team
          </p>
        </div>
      `,
    });

    if (emailResponse.error) {
      console.error("send-welcome-email: provider error", emailResponse.error);
      return json({ error: "Failed to send email" }, 502);
    }

    return json({ success: true }, 200);
  } catch (error) {
    console.error("send-welcome-email: unexpected error", error);
    return json({ error: "Failed to send email" }, 500);
  }
};

serve(handler);
