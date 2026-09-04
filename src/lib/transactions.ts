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

export interface DirectionalTransaction {
  amount: number | string;
  direction?: TransactionDirection;
}

export function isCredit(t: DirectionalTransaction): boolean {
  return t.direction === "credit";
}

/** Legacy (null direction) rows count as spending. */
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
