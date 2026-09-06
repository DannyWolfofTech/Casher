import { describe, it, expect } from "vitest";
import { planCtaState } from "../pricing-cta";

describe("planCtaState", () => {
  it("shows Get Started Free to signed out visitors", () => {
    expect(planCtaState("free", false, null)).toEqual({
      labelKey: "getStartedFree",
      disabled: false,
      action: "signup",
    });
  });

  it("shows Current plan on Free for an authenticated free user", () => {
    expect(planCtaState("free", true, "free")).toEqual({
      labelKey: "currentPlan",
      disabled: true,
      action: "none",
    });
  });

  it("routes paid-to-free changes through billing cancellation", () => {
    expect(planCtaState("free", true, "pro")).toEqual({ labelKey: 'manageBilling', disabled: false, action: 'billing' });
  });

  it("marks the matching paid plan as current", () => {
    expect(planCtaState("pro", true, "pro").labelKey).toBe("currentPlan");
    expect(planCtaState("premium", true, "Premium").labelKey).toBe("currentPlan");
  });

  it("offers checkout on non-current paid plans that are on sale", () => {
    // Premium is intentionally not purchasable yet — see launch-readiness tests.
    expect(planCtaState("premium", true, "pro")).toEqual({
      labelKey: "comingSoonShort",
      disabled: true,
      action: "none",
    });
    expect(planCtaState("pro", false, null).action).toBe("checkout");
  });
});
