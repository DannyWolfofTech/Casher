import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  categorizeTransaction,
  detectSubscription,
  extractMerchant,
  parseAmount,
  mapRowToTransaction,
  RowProcessingResult,
} from "./utils.ts";

const TEST_USER_ID = "00000000-0000-0000-0000-000000000000";

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

// Tests for parseAmount
Deno.test("parseAmount - handles common en-GB and HSBC formats", () => {
  const cases: Array<[unknown, number | null]> = [
    ["-9.99", -9.99],
    ["£165.45", 165.45],
    ["£165,45", 165.45],
    ["1,234.56", 1234.56],
    ["1.234,56", 1234.56],
    ["(123.45)", -123.45],
    ["123-", -123],
    [123.45, 123.45],
    ["DR 45.00", -45],
    ["CR 99.99", 99.99],
    ["", null],
    ["invalid", null],
  ];

  for (const [input, expected] of cases) {
    const result = parseAmount(input);

    if (expected === null) {
      assertEquals(result, null);
    } else {
      const roundedResult = Number(result!.toFixed(5));
      const roundedExpected = Number(expected.toFixed(5));
      assertEquals(roundedResult, roundedExpected);
    }
  }
});

// Tests for mapRowToTransaction with HSBC-like data
Deno.test("mapRowToTransaction - handles HSBC CSV rows with accurate totals", () => {
  const rows = [
    { "Transaction Description": "Netflix", Amount: "-9.99", Date: "15/01/2025" },
    { "Transaction Description": "Salary", Amount: "2,000.00", Date: "2025-01-31" },
    { "Transaction Description": "Groceries Tesco", Amount: "-96,50", Date: "01/02/2025" },
    { "Transaction Description": "Gym Membership", Amount: "-35.00", Date: "02/02/2025" },
  ];

  const processed = rows
    .map((row) => mapRowToTransaction(row, TEST_USER_ID))
    .filter((result): result is RowProcessingResult => result !== null);

  assertEquals(processed.length, 4);

  const netflix = processed[0].transaction;
  assertEquals(netflix.amount, -9.99);
  assertEquals(netflix.date, "2025-01-15");
  assertEquals(netflix.is_recurring, true);
  assertEquals(processed[0].subscriptionAmount, 9.99);

  const salary = processed[1].transaction;
  assertEquals(salary.amount, 2000);
  assertEquals(salary.date, "2025-01-31");

  const groceries = processed[2].transaction;
  assertEquals(Number(groceries.amount.toFixed(2)), -96.5);
  assertEquals(groceries.category, "Groceries");

  const gym = processed[3].transaction;
  assertEquals(gym.amount, -35);
  assertEquals(gym.is_recurring, true);

  const netTotal = processed.reduce((sum, item) => sum + item.transaction.amount, 0);
  assertEquals(Number(netTotal.toFixed(2)), 1858.51);
});

Deno.test("mapRowToTransaction - handles separate debit and credit columns", () => {
  const debitRow = {
    "Transaction Description": "HSBC Debit",
    "Debit Amount": "45.00",
    Date: "10/02/2025",
  };

  const creditRow = {
    "Transaction Description": "HSBC Credit",
    "Credit Amount": "99.50",
    Date: "11/02/2025",
  };

  const debitResult = mapRowToTransaction(debitRow, TEST_USER_ID);
  const creditResult = mapRowToTransaction(creditRow, TEST_USER_ID);

  assertEquals(debitResult!.transaction.amount, -45);
  assertEquals(creditResult!.transaction.amount, 99.5);
});

Deno.test("mapRowToTransaction - returns null for zero or missing amounts", () => {
  const zeroAmountRow = {
    "Transaction Description": "Zero Amount",
    Amount: "0.00",
    Date: "10/01/2025",
  };

  const missingAmountRow = {
    "Transaction Description": "Missing Amount",
    Date: "11/01/2025",
  };

  const zeroResult = mapRowToTransaction(zeroAmountRow, TEST_USER_ID);
  const missingResult = mapRowToTransaction(missingAmountRow, TEST_USER_ID);

  assertEquals(zeroResult, null);
  assertEquals(missingResult, null);
});
