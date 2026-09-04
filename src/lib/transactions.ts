/**
 * Display helpers for transaction cash-flow direction.
 *
 * Backwards compatibility contract:
 *   direction === "credit"  -> money in  (never counted as spending)
 *   direction === "debit"   -> money out (counted as spending)
 *   direction == null       -> LEGACY row imported before import_version 2.
 *                              Those rows were stored as absolute values with
 *                              no direction, and were always treated as
 *                              spending. We keep that behaviour exactly.
 */

export type TransactionDirection = "debit" | "credit" | null | undefined;

/**
 * Category written for money-in rows by the importer. It is the fallback
 * direction signal on databases where `transactions.direction` does not exist
 * yet, so a row categorised as Income is always a credit.
 */
export const INCOME_CATEGORY = "Income";

/**
 * High-confidence income descriptions used ONLY for legacy rows that have no
 * `direction` at all. Whole-word matches only, and deliberately narrow: we do
 * not infer income from "refund", "credit" or a positive amount.
 */
const LEGACY_INCOME_DESCRIPTION = /\b(salary|salaries|payroll|wages)\b/i;

export interface DirectionalTransaction {
  amount: number | string;
  direction?: TransactionDirection;
  category?: string | null;
  description?: string | null;
}

export function isCredit(t: DirectionalTransaction): boolean {
  // Explicit direction always wins.
  if (t.direction === "credit") return true;
  if (t.direction === "debit") return false;
  // No direction column (pre-migration rows): fall back to the category tag.
  if ((t.category ?? "").trim().toLowerCase() === INCOME_CATEGORY.toLowerCase()) return true;
  // Narrow legacy-only fallback for unmistakable income descriptions.
  return LEGACY_INCOME_DESCRIPTION.test(t.description ?? "");
}


/** Legacy (null direction, non-Income) rows count as spending. */
export function isSpending(t: DirectionalTransaction): boolean {
  return !isCredit(t);
}


/** Positive magnitude of money out, or 0 for credits. */
export function spendingAmount(t: DirectionalTransaction): number {
  if (isCredit(t)) return 0;
  const n = Number(t.amount);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

/** Positive magnitude of money in, or 0 for debits/legacy rows. */
export function creditAmount(t: DirectionalTransaction): number {
  if (!isCredit(t)) return 0;
  const n = Number(t.amount);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

/** Sum of money out across a batch. */
export function sumSpending(rows: DirectionalTransaction[]): number {
  return rows.reduce((sum, t) => sum + spendingAmount(t), 0);
}

/** Sum of money in across a batch. */
export function sumCredits(rows: DirectionalTransaction[]): number {
  return rows.reduce((sum, t) => sum + creditAmount(t), 0);
}

/** Signed display string, e.g. "-£12.99" / "+£500.00". */
export function formatSignedAmount(t: DirectionalTransaction): string {
  const magnitude = Math.abs(Number(t.amount) || 0).toFixed(2);
  return isCredit(t) ? `+£${magnitude}` : `-£${magnitude}`;
}
