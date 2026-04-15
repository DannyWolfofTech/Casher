import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { PRICE_ID_TO_TIER } from "../_shared/stripe-tiers.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const webhookUrl = `${SUPABASE_URL}/functions/v1/stripe-webhook`;

// --- Unit tests for tier mapping (used by webhook) ---

Deno.test("stripe-tiers - maps pro price ID correctly", () => {
  assertEquals(PRICE_ID_TO_TIER["price_1SYzJQJMS012Ip2AChBRKO5w"], "pro");
});

Deno.test("stripe-tiers - maps premium price ID correctly", () => {
  assertEquals(PRICE_ID_TO_TIER["price_1SYzKoJMS012Ip2Ask6ktJJi"], "premium");
});

Deno.test("stripe-tiers - unknown price returns undefined", () => {
  assertEquals(PRICE_ID_TO_TIER["price_unknown_123"], undefined);
});

// --- Integration tests for webhook endpoint ---

Deno.test("webhook - rejects requests without stripe-signature", async () => {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ type: "checkout.session.completed" }),
  });
  const body = await res.json();
  // Should fail signature verification → 400 or 500
  assertEquals(res.status >= 400, true);
  await res.text().catch(() => {});
});

Deno.test("webhook - rejects invalid signature", async () => {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      "stripe-signature": "t=123,v1=invalid_sig",
    },
    body: JSON.stringify({ id: "evt_test", type: "checkout.session.completed" }),
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assertExists(body.error);
});

Deno.test("webhook - handles CORS preflight", async () => {
  const res = await fetch(webhookUrl, {
    method: "OPTIONS",
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  await res.text();
  assertEquals(res.status, 200);
});
