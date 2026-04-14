/**
 * Centralized Stripe price-to-tier mapping for edge functions.
 * Keep in sync with src/config/stripe.ts
 */

export const STRIPE_TIERS = {
  pro: {
    priceId: "price_1SYzJQJMS012Ip2AChBRKO5w",
  },
  premium: {
    priceId: "price_1SYzKoJMS012Ip2Ask6ktJJi",
  },
} as const;

/** Reverse lookup: price ID → tier name */
export const PRICE_ID_TO_TIER: Record<string, string> = Object.fromEntries(
  Object.entries(STRIPE_TIERS).map(([tier, { priceId }]) => [priceId, tier])
);
