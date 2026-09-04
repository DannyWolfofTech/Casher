import { describe, expect, it } from "vitest";
// Real shared parser used by the process-csv edge function.
import {
  INCOME_CATEGORY,
  parseTransactionsCsv,
} from "../../../supabase/functions/_shared/csv-parser";
import {
  creditAmount,
  formatSignedAmount,
  isCredit,
  spendingAmount,
  sumCredits,
  sumSpending,
  type DirectionalTransaction,
} from "@/lib/transactions";

/** Debit Amount / Credit Amount fixture: six debits (£289.08) + one credit. */
const FIXTURE = [
  "Date,Description,Debit Amount,Credit Amount",
  "01/09/2026,NETFLIX SUBSCRIPTION,15.99,",
  "02/09/2026,SPOTIFY SUBSCRIPTION,11.99,",
  "03/09/2026,TESCO GROCERY,64.20,",
  "04/09/2026,PUREGYM FITNESS,24.99,",
  "05/09/2026,UBER TRANSPORT,22.40,",
  "06/09/2026,RENT PAYMENT,149.51,",
  "07/09/2026,SYNTHETIC SALARY,,2500.00",
].join("\n");

const parsed = (() => {
  const result = parseTransactionsCsv(FIXTURE);
  if (result.ok !== true) throw new Error("fixture failed to parse");
  return result;
})();


/** What the pre-migration database keeps: no direction column, |amount|. */
const asLegacyRows = (): DirectionalTransaction[] =>
  parsed.transactions.map((t) => ({
    amount: Math.abs(t.amount),
    category: t.category,
  }));

describe("credit/debit import fixture", () => {
  it("parses six debits and one credit", () => {
    const debits = parsed.transactions.filter((t) => t.direction === "debit");
    const credits = parsed.transactions.filter((t) => t.direction === "credit");
    expect(debits).toHaveLength(6);
    expect(credits).toHaveLength(1);
    expect(credits[0].amount).toBeCloseTo(2500);
    expect(credits[0].category).toBe(INCOME_CATEGORY);
    expect(credits[0].isSubscription).toBe(false);
  });

  it("totals £289.08 of spending and £2500 of credits (signed rows)", () => {
    expect(sumSpending(parsed.transactions)).toBeCloseTo(289.08, 2);
    expect(sumCredits(parsed.transactions)).toBeCloseTo(2500, 2);
  });

  it("keeps the credit out of spending on the pre-migration schema", () => {
    const rows = asLegacyRows();
    expect(sumSpending(rows)).toBeCloseTo(289.08, 2);
    expect(sumCredits(rows)).toBeCloseTo(2500, 2);
    const salary = rows.find((r) => r.category === INCOME_CATEGORY)!;
    expect(isCredit(salary)).toBe(true);
    expect(spendingAmount(salary)).toBe(0);
    expect(creditAmount(salary)).toBeCloseTo(2500);
  });

  it("excludes credits from category totals", () => {
    const totals: Record<string, number> = {};
    for (const row of asLegacyRows()) {
      const value = spendingAmount(row);
      if (value <= 0) continue;
      const key = row.category || "Other";
      totals[key] = (totals[key] ?? 0) + value;
    }
    expect(totals[INCOME_CATEGORY]).toBeUndefined();
    expect(totals["Other"]).toBeUndefined();
    expect(Object.values(totals).reduce((a, b) => a + b, 0)).toBeCloseTo(289.08, 2);
  });

  it("presents the credit as positive money in", () => {
    const salary = asLegacyRows().find((r) => r.category === INCOME_CATEGORY)!;
    expect(formatSignedAmount(salary)).toBe("+£2500.00");
    const debit = asLegacyRows().find((r) => r.category === "Subscription")!;
    expect(formatSignedAmount(debit).startsWith("-")).toBe(true);
  });

  it("still treats legacy uncategorised rows as spending", () => {
    expect(isCredit({ amount: 12.99, category: "Other" })).toBe(false);
    expect(spendingAmount({ amount: 12.99, category: null })).toBeCloseTo(12.99);
  });
});
