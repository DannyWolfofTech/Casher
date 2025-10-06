import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.190.0/testing/asserts.ts";

// Helper functions extracted for testing
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

// Tests for categorizeTransaction
Deno.test("categorizeTransaction - detects Netflix subscription", () => {
  const result = categorizeTransaction("NETFLIX.COM Payment");
  assertEquals(result, "Subscription");
});

Deno.test("categorizeTransaction - detects Spotify subscription", () => {
  const result = categorizeTransaction("Spotify Premium UK");
  assertEquals(result, "Subscription");
});

Deno.test("categorizeTransaction - detects Disney Plus", () => {
  const result = categorizeTransaction("Disney+ Monthly");
  assertEquals(result, "Subscription");
});

Deno.test("categorizeTransaction - detects gym/fitness", () => {
  const result = categorizeTransaction("PureGym Membership");
  assertEquals(result, "Fitness");
});

Deno.test("categorizeTransaction - detects rent", () => {
  const result = categorizeTransaction("Monthly Rent Payment");
  assertEquals(result, "Rent");
});

Deno.test("categorizeTransaction - detects groceries from Tesco", () => {
  const result = categorizeTransaction("TESCO STORE 1234");
  assertEquals(result, "Groceries");
});

Deno.test("categorizeTransaction - detects groceries from Sainsbury's", () => {
  const result = categorizeTransaction("Sainsbury's Local");
  assertEquals(result, "Groceries");
});

Deno.test("categorizeTransaction - detects dining", () => {
  const result = categorizeTransaction("Nando's Restaurant");
  assertEquals(result, "Dining");
});

Deno.test("categorizeTransaction - detects transport", () => {
  const result = categorizeTransaction("UBER TRIP");
  assertEquals(result, "Transport");
});

Deno.test("categorizeTransaction - defaults to Other for unknown", () => {
  const result = categorizeTransaction("Random Shop Purchase");
  assertEquals(result, "Other");
});

// Tests for detectSubscription
Deno.test("detectSubscription - detects Netflix", () => {
  const result = detectSubscription("NETFLIX.COM Payment");
  assertEquals(result, true);
});

Deno.test("detectSubscription - detects Spotify", () => {
  const result = detectSubscription("Spotify Premium");
  assertEquals(result, true);
});

Deno.test("detectSubscription - detects Amazon Prime", () => {
  const result = detectSubscription("Amazon Prime Membership");
  assertEquals(result, true);
});

Deno.test("detectSubscription - detects gym membership", () => {
  const result = detectSubscription("David Lloyd Gym Membership");
  assertEquals(result, true);
});

Deno.test("detectSubscription - detects monthly keyword", () => {
  const result = detectSubscription("Software Monthly License");
  assertEquals(result, true);
});

Deno.test("detectSubscription - detects annual keyword", () => {
  const result = detectSubscription("Insurance Annual Premium");
  assertEquals(result, true);
});

Deno.test("detectSubscription - returns false for one-time purchase", () => {
  const result = detectSubscription("Amazon.co.uk Purchase");
  assertEquals(result, false);
});

Deno.test("detectSubscription - returns false for grocery shopping", () => {
  const result = detectSubscription("TESCO STORE 5678");
  assertEquals(result, false);
});

// Tests for extractMerchant
Deno.test("extractMerchant - removes UK date format", () => {
  const result = extractMerchant("NETFLIX.COM 15/03/2024 Payment");
  assertEquals(result, "NETFLIX.COM Payment");
});

Deno.test("extractMerchant - removes transaction codes", () => {
  const result = extractMerchant("GB 123 TESCO STORE");
  assertEquals(result, "TESCO STORE");
});

Deno.test("extractMerchant - handles clean merchant name", () => {
  const result = extractMerchant("Spotify Premium UK");
  assertEquals(result, "Spotify Premium UK");
});

Deno.test("extractMerchant - truncates long names to 50 chars", () => {
  const longName = "This is a very long merchant name that exceeds fifty characters and should be truncated";
  const result = extractMerchant(longName);
  assertEquals(result.length, 50);
  assertStringIncludes(result, "This is a very long merchant name that exceeds fi");
});

Deno.test("extractMerchant - removes multiple dates", () => {
  const result = extractMerchant("12/01/2024 AMAZON 25/12/2023 Purchase");
  assertEquals(result, "AMAZON Purchase");
});

Deno.test("extractMerchant - handles empty string", () => {
  const result = extractMerchant("");
  assertEquals(result, "");
});

Deno.test("extractMerchant - trims whitespace", () => {
  const result = extractMerchant("   HSBC BANK   ");
  assertEquals(result, "HSBC BANK");
});
