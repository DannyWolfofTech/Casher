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

export interface DirectionalTransaction {
  amount: number | string;
  direction?: TransactionDirection;
  category?: string | null;
}

export function isCredit(t: DirectionalTransaction): boolean {
  if (t.direction === "credit") return true;
  if (t.direction === "debit") return false;
  // No direction column (pre-migration rows): fall back to the category tag.
  return (t.category ?? "").trim().toLowerCase() === INCOME_CATEGORY.toLowerCase();
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
