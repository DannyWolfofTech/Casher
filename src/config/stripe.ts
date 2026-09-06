/**
 * Advertised plans. Stripe price IDs and account selection are server-owned.
 */

export const STRIPE_TIERS = {
  pro: {
    label: "Pro",
    price: "£9.99",
  },
  premium: {
    label: "Premium",
    price: "£14.99",
  },
} as const;
