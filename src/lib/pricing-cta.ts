export type PlanKey = "free" | "pro" | "premium";

export interface PlanCtaState {
  /** Translation key for the button label. */
  labelKey: "currentPlan" | "getStartedFree" | "upgradeNow" | "comingSoonShort" | "manageBilling" | "newSubscriptionsPaused";
  disabled: boolean;
  /** What clicking the button should do. */
  action: "none" | "signup" | "checkout" | "billing";
}

/**
 * Premium is not purchasable until its differentiated features ship.
 * Presentation-only flag: no Stripe product, price or entitlement changes.
 */
export const PREMIUM_PURCHASABLE = false;
// Release gate: owner business disclosures and fresh Stripe lifecycle acceptance.
// Backend independently requires CASHER_LIVE_CHECKOUT_ENABLED=true for live sales.
export const PRO_PURCHASABLE = false;

/**
 * Presentation-only mapping for the pricing card call to action.
 * Does not touch entitlement or billing logic.
 */
export function planCtaState(
  planKey: PlanKey,
  isAuthenticated: boolean,
  userTier: string | null | undefined,
): PlanCtaState {
  const tier = (userTier || "free").toLowerCase();

  if (planKey === "free") {
    if (isAuthenticated && tier === "free") {
      return { labelKey: "currentPlan", disabled: true, action: "none" };
    }
    if (isAuthenticated) return { labelKey: 'manageBilling', disabled: false, action: 'billing' };
    return { labelKey: "getStartedFree", disabled: false, action: "signup" };
  }

  if (isAuthenticated && tier === planKey) {
    return { labelKey: "currentPlan", disabled: true, action: "none" };
  }
  if (isAuthenticated && tier === 'premium' && planKey === 'pro') return { labelKey: 'manageBilling', disabled: false, action: 'billing' };

  // Existing Premium subscribers keep their "Current plan" state above; for
  // everyone else Premium is shown as coming soon and cannot start checkout.
  if (planKey === "premium" && !PREMIUM_PURCHASABLE) {
    return { labelKey: "comingSoonShort", disabled: true, action: "none" };
  }

  if (planKey === 'pro' && !PRO_PURCHASABLE) {
    return {labelKey:'newSubscriptionsPaused',disabled:true,action:'none'};
  }

  return { labelKey: "upgradeNow", disabled: false, action: "checkout" };
}
