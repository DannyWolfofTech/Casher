import { describe, expect, it } from "vitest";
import {
  creditAmount,
  formatSignedAmount,
  isCredit,
  isSpending,
  spendingAmount,
  sumSpending,
  type DirectionalTransaction,
} from "@/lib/transactions";
import { detectSubscription } from "../../../supabase/functions/_shared/csv-parser";

const row = (r: Partial<DirectionalTransaction>): DirectionalTransaction =>
  ({ amount: 0, ...r }) as DirectionalTransaction;

describe("legacy income fallback", () => {
  it("treats a legacy 'Synthetic Salary' row (null direction, category Other) as a credit", () => {
    const t = row({ amount: 2500, direction: null, category: "Other", description: "Synthetic Salary" });
    expect(isCredit(t)).toBe(true);
    expect(isSpending(t)).toBe(false);
    expect(spendingAmount(t)).toBe(0);
    expect(creditAmount(t)).toBeCloseTo(2500);
    expect(formatSignedAmount(t)).toBe("+£2500.00");
  });

  it("fixes the mixed dashboard total (£3,869.00 -> £1,369.00)", () => {
    const rows = [
      row({ amount: 2500, direction: null, category: "Other", description: "Synthetic Salary" }),
      row({ amount: 950, direction: "debit", category: "Rent", description: "Monthly Rent" }),
      row({ amount: 419, direction: "debit", category: "Other", description: "Sundries" }),
    ];
    expect(sumSpending(rows)).toBeCloseTo(1369);
  });

  it("lets explicit direction always win", () => {
    expect(isCredit(row({ amount: 100, direction: "debit", description: "Salary advance repayment" }))).toBe(false);
    expect(isCredit(row({ amount: 100, direction: "credit", description: "Anything" }))).toBe(true);
  });

  it("does not infer income from refunds, credits or positive amounts", () => {
    expect(isCredit(row({ amount: 40, direction: null, description: "Amazon refund" }))).toBe(false);
    expect(isCredit(row({ amount: 40, direction: null, description: "Credit adjustment" }))).toBe(false);
    expect(isCredit(row({ amount: 40, direction: null, description: "Tesco Store" }))).toBe(false);
  });

  it("matches only whole words", () => {
    expect(isCredit(row({ amount: 40, direction: null, description: "Salarymen Sushi" }))).toBe(false);
    expect(isCredit(row({ amount: 40, direction: null, description: "ACME PAYROLL BACS" }))).toBe(true);
    expect(isCredit(row({ amount: 40, direction: null, description: "Weekly wages" }))).toBe(true);
  });
});

describe("detectSubscription false positives", () => {
  it("rejects rent and mortgage", () => {
    expect(detectSubscription("Monthly Rent")).toBe(false);
    expect(detectSubscription("Annual Mortgage")).toBe(false);
    expect(detectSubscription("Rent payment to landlord")).toBe(false);
  });

  it("rejects generic temporal words alone", () => {
    expect(detectSubscription("Monthly transfer")).toBe(false);
    expect(detectSubscription("Annual insurance premium")).toBe(false);
  });

  it("keeps high-confidence detections", () => {
    for (const d of [
      "Acme Annual Membership",
      "PureGym Membership",
      "Amazon Prime",
      "NETFLIX.COM",
      "Spotify Premium UK",
      "Adobe subscription",
    ]) {
      expect(detectSubscription(d), d).toBe(true);
    }
  });
});
