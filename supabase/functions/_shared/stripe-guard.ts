/**
 * Server-side guards for Stripe checkout.
 *
 * Both the price ID and the redirect origin arrive from the browser, so both
 * are treated as untrusted input:
 *  - price IDs must be one of the tiers we actually sell (fail closed);
 *  - redirect origins must be on an explicit allowlist, otherwise we fall back
 *    to the canonical site so a forged `Origin` header cannot turn a checkout
 *    into an open redirect.
 *
 * No live/financial behaviour is changed here: the same keys, prices and mode
 * are used, we only reject inputs we would previously have trusted blindly.
 */

import { STRIPE_TIERS } from "./stripe-tiers.ts";

export const CANONICAL_ORIGIN = "https://trycasher.com";

export const ALLOWED_PRICE_IDS: readonly string[] = Object.values(STRIPE_TIERS).map(
  (t) => t.priceId,
);

/**
 * Static origins that are always allowed.
 *
 * The Lovable hosts are pinned to this project's exact preview/published URLs.
 * A wildcard such as `*.lovable.app` would let any third-party Lovable project
 * be used as a Checkout return origin.
 */
const STATIC_ALLOWED_ORIGINS = [
  CANONICAL_ORIGIN,
  "https://www.trycasher.com",
  "https://id-preview--ea77ebbb-78bd-46c4-a0c9-0ab73994a416.lovable.app",
  "https://preview--trycasher-com.lovable.app",
  "https://ea77ebbb-78bd-46c4-a0c9-0ab73994a416.lovableproject.com",
  "http://localhost:8080",
  "http://localhost:5173",
];

function extraAllowedOrigins(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function isAllowedPriceId(priceId: unknown): priceId is string {
  return typeof priceId === "string" && ALLOWED_PRICE_IDS.includes(priceId);
}

/** Premium remains unavailable even when a client calls checkout directly. */
export function isPurchasablePriceId(priceId: unknown): priceId is string {
  return priceId === STRIPE_TIERS.pro.priceId;
}

export function isAllowedOrigin(origin: string, extraRaw?: string | null): boolean {
  const normalized = origin.replace(/\/$/, "");
  if (STATIC_ALLOWED_ORIGINS.includes(normalized)) return true;
  return extraAllowedOrigins(extraRaw).includes(normalized);
}

/**
 * Resolve a safe return origin. Anything not on the allowlist (including a
 * missing or malformed header) collapses to the canonical origin.
 */
export function safeReturnOrigin(
  originHeader: string | null | undefined,
  extraRaw?: string | null,
): string {
  if (!originHeader) return CANONICAL_ORIGIN;
  let candidate: string;
  try {
    const url = new URL(originHeader);
    candidate = `${url.protocol}//${url.host}`;
  } catch {
    return CANONICAL_ORIGIN;
  }
  return isAllowedOrigin(candidate, extraRaw) ? candidate : CANONICAL_ORIGIN;
}

export type EntitlementStatus = "active" | "past_due" | "canceled" | "inactive";

export interface EntitlementUpdate {
  subscription_tier: string;
  subscription_status: EntitlementStatus;
}

/**
 * Map a Stripe subscription status + price to the entitlement we store.
 * Anything that is not a paying state loses the paid tier, so entitlement can
 * never stay stale after a cancellation or a failed payment.
 */
export function entitlementForSubscription(
  stripeStatus: string,
  priceId: string | undefined,
  priceToTier: Record<string, string>,
): EntitlementUpdate {
  const tier = (priceId && priceToTier[priceId]) || "free";
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return { subscription_tier: tier, subscription_status: "active" };
    case "past_due":
    case "unpaid":
      return { subscription_tier: "free", subscription_status: "past_due" };
    case "canceled":
    case "incomplete_expired":
      return { subscription_tier: "free", subscription_status: "canceled" };
    default:
      return { subscription_tier: "free", subscription_status: "inactive" };
  }
}
