export type PlanKey = "free" | "pro" | "premium";

export interface PlanCtaState {
  /** Translation key for the button label. */
  labelKey: "currentPlan" | "getStartedFree" | "upgradeNow";
  disabled: boolean;
  /** What clicking the button should do. */
  action: "none" | "signup" | "checkout";
}

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
    return { labelKey: "getStartedFree", disabled: false, action: "signup" };
  }

  if (isAuthenticated && tier === planKey) {
    return { labelKey: "currentPlan", disabled: true, action: "none" };
  }

  return { labelKey: "upgradeNow", disabled: false, action: "checkout" };
}
