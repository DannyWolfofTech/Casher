import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.190.0/testing/asserts.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const baseUrl = `${SUPABASE_URL}/functions/v1/create-checkout-session`;

Deno.test("checkout - rejects unauthenticated requests", async () => {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ priceId: "price_test" }),
  });
  const body = await res.text();
  assertEquals(res.status >= 400, true);
});

Deno.test("checkout - rejects missing priceId", async () => {
  // Even with a fake auth header, missing priceId should error
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer invalid_token",
    },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  assertEquals(res.status >= 400, true);
});

Deno.test("checkout - handles CORS preflight", async () => {
  const res = await fetch(baseUrl, {
    method: "OPTIONS",
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  await res.text();
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});
