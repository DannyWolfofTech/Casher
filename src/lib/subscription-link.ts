/**
 * Linking a transaction row to the detected subscription it belongs to.
 *
 * We deliberately avoid broad "update every row with this merchant" writes.
 * A link is only made when the amounts match to the penny AND the service name
 * is recognisable inside the transaction description (or vice versa), so a
 * single "mark as canceled" action can only ever flip one specific detected
 * subscription row.
 */

export interface LinkableSubscription {
  id: string;
  service_name: string;
  amount: number | string;
  status?: string | null;
  estimated_annual_cost?: number | string | null;
}

export interface LinkableTransaction {
  description: string;
  amount: number | string;
  merchant?: string | null;
}

const AMOUNT_TOLERANCE = 0.005;

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function amountsMatch(a: unknown, b: unknown): boolean {
  const x = Math.abs(Number(a));
  const y = Math.abs(Number(b));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.abs(x - y) <= AMOUNT_TOLERANCE;
}

function namesMatch(sub: LinkableSubscription, tx: LinkableTransaction): boolean {
  const service = normalizeName(sub.service_name || "");
  if (service.length < 3) return false;
  const haystacks = [normalizeName(tx.description || "")];
  if (tx.merchant) haystacks.push(normalizeName(tx.merchant));
  return haystacks.some((h) => h.includes(service) || (h.length >= 3 && service.includes(h)));
}

/**
 * Return the single detected subscription that matches this transaction, or
 * null when the match is ambiguous (0 or >1 candidates).
 */
export function findLinkedSubscription(
  transaction: LinkableTransaction,
  subscriptions: LinkableSubscription[],
): LinkableSubscription | null {
  const candidates = subscriptions.filter(
    (s) => amountsMatch(s.amount, transaction.amount) && namesMatch(s, transaction),
  );
  return candidates.length === 1 ? candidates[0] : null;
}

export interface SubscriptionSummary {
  subscriptionCount: number;
  potentialSavings: number;
}

/** Dashboard summary derived from detected subscriptions (active only count). */
export function summarizeSubscriptions(subs: LinkableSubscription[]): SubscriptionSummary {
  const active = subs.filter((s) => (s.status ?? "active") === "active");
  return {
    subscriptionCount: active.length,
    potentialSavings: active.reduce((sum, s) => {
      const n = Number(s.estimated_annual_cost);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0),
  };
}

/**
 * Apply a cancel/uncancel toggle to a local subscription list so the dashboard
 * summary stays consistent with what was written to the database.
 */
export function applyCancellation(
  subs: LinkableSubscription[],
  subscriptionId: string,
  canceled: boolean,
): LinkableSubscription[] {
  return subs.map((s) =>
    s.id === subscriptionId ? { ...s, status: canceled ? "canceled" : "active" } : s,
  );
}

export const CANCELED_CATEGORY = "Canceled Subscription";

/** Category a transaction should carry after a cancel/uncancel toggle. */
export function nextTransactionCategory(canceled: boolean): string {
  return canceled ? CANCELED_CATEGORY : "Subscription";
}

export type CancellationSyncResult =
  | { linked: false }
  | { linked: true; subscriptionId: string };

export interface CancellationSyncDeps {
  /** Load candidate subscriptions. Must throw on database errors. */
  listSubscriptions: () => Promise<LinkableSubscription[]>;
  /** Persist the new status for exactly one subscription. Must throw on failure. */
  updateSubscriptionStatus: (id: string, status: string) => Promise<void>;
}

/**
 * Flip the status of the single detected subscription linked to a transaction.
 *
 * Database errors are propagated (never swallowed) so the caller can compensate
 * and report failure. When no unambiguous link exists, nothing is written.
 */
export async function syncLinkedSubscriptionStatus(
  transaction: LinkableTransaction,
  canceled: boolean,
  deps: CancellationSyncDeps,
): Promise<CancellationSyncResult> {
  const subs = await deps.listSubscriptions();
  const match = findLinkedSubscription(transaction, subs);
  if (!match) return { linked: false };
  await deps.updateSubscriptionStatus(match.id, canceled ? "canceled" : "active");
  return { linked: true, subscriptionId: match.id };
}
