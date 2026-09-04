import { describe, expect, it } from "vitest";
import {
  creditAmount,
  formatSignedAmount,
  isCredit,
  isSpending,
  spendingAmount,
  sumCredits,
  sumSpending,
  type DirectionalTransaction,
} from "@/lib/transactions";

const tx = (amount: number, direction: DirectionalTransaction["direction"]): DirectionalTransaction =>
  ({ amount, direction }) as DirectionalTransaction;

describe("direction helpers", () => {
  it("treats explicit debits as spending", () => {
    expect(isSpending(tx(-12.99, "debit"))).toBe(true);
    expect(isCredit(tx(-12.99, "debit"))).toBe(false);
    expect(spendingAmount(tx(-12.99, "debit"))).toBeCloseTo(12.99);
    expect(creditAmount(tx(-12.99, "debit"))).toBe(0);
  });

  it("treats explicit credits as income, never spending", () => {
    expect(isCredit(tx(2500, "credit"))).toBe(true);
    expect(isSpending(tx(2500, "credit"))).toBe(false);
    expect(spendingAmount(tx(2500, "credit"))).toBe(0);
    expect(creditAmount(tx(2500, "credit"))).toBeCloseTo(2500);
  });

  it("keeps legacy rows (null direction) counted as spending", () => {
    expect(isSpending(tx(12.99, null))).toBe(true);
    expect(spendingAmount(tx(12.99, null))).toBeCloseTo(12.99);
    expect(isSpending(tx(12.99, undefined))).toBe(true);
    // Legacy rows were stored unsigned, so magnitude is what matters.
    expect(spendingAmount(tx(-12.99, null))).toBeCloseTo(12.99);
  });

  it("sums a mixed legacy/modern ledger correctly", () => {
    const rows = [
      tx(-12.99, "debit"),
      tx(-40, "debit"),
      tx(2500, "credit"),
      tx(9.99, null), // legacy spending
    ];
    expect(sumSpending(rows)).toBeCloseTo(62.98);
    expect(sumCredits(rows)).toBeCloseTo(2500);
  });

  it("formats amounts with an explicit sign for modern rows", () => {
    expect(formatSignedAmount(tx(-12.99, "debit"))).toContain("12.99");
    expect(formatSignedAmount(tx(2500, "credit")).startsWith("+")).toBe(true);
  });
});
