/**
 * Centralized Stripe price-to-tier mapping.
 * Used by the frontend (Pricing page) and mirrored in edge functions.
 */

export const STRIPE_TIERS = {
  pro: {
    priceId: "price_1SYzJQJMS012Ip2AChBRKO5w",
    label: "Pro",
    price: "£9.99",
  },
  premium: {
    priceId: "price_1SYzKoJMS012Ip2Ask6ktJJi",
    label: "Premium",
    price: "£14.99",
  },
} as const;

/** Reverse lookup: price ID → tier name */
export const PRICE_ID_TO_TIER: Record<string, string> = Object.fromEntries(
  Object.entries(STRIPE_TIERS).map(([tier, { priceId }]) => [priceId, tier])
);
