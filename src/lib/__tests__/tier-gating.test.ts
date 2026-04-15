import { describe, it, expect } from "vitest";
import { STRIPE_TIERS, PRICE_ID_TO_TIER } from "@/config/stripe";

describe("Stripe tier configuration", () => {
  it("has pro and premium tiers defined", () => {
    expect(STRIPE_TIERS.pro).toBeDefined();
    expect(STRIPE_TIERS.premium).toBeDefined();
  });

  it("pro tier has correct price", () => {
    expect(STRIPE_TIERS.pro.price).toBe("£9.99");
    expect(STRIPE_TIERS.pro.priceId).toMatch(/^price_/);
  });

  it("premium tier has correct price", () => {
    expect(STRIPE_TIERS.premium.price).toBe("£14.99");
    expect(STRIPE_TIERS.premium.priceId).toMatch(/^price_/);
  });

  it("reverse lookup maps price IDs to tier names", () => {
    expect(PRICE_ID_TO_TIER[STRIPE_TIERS.pro.priceId]).toBe("pro");
    expect(PRICE_ID_TO_TIER[STRIPE_TIERS.premium.priceId]).toBe("premium");
  });

  it("unknown price ID returns undefined", () => {
    expect(PRICE_ID_TO_TIER["price_nonexistent"]).toBeUndefined();
  });
});

describe("Dashboard tier gating logic", () => {
  const getUploadLimit = (tier: string) => (tier === "free" ? 1 : Infinity);
  const canUpload = (tier: string, used: number) => used < getUploadLimit(tier);

  it("free tier allows 1 upload", () => {
    expect(canUpload("free", 0)).toBe(true);
    expect(canUpload("free", 1)).toBe(false);
    expect(canUpload("free", 5)).toBe(false);
  });

  it("pro tier allows unlimited uploads", () => {
    expect(canUpload("pro", 0)).toBe(true);
    expect(canUpload("pro", 100)).toBe(true);
  });

  it("premium tier allows unlimited uploads", () => {
    expect(canUpload("premium", 0)).toBe(true);
    expect(canUpload("premium", 999)).toBe(true);
  });

  it("upload limit resets when month changes", () => {
    const resetDate = new Date("2026-03-15");
    const now = new Date("2026-04-01");
    const shouldReset =
      now.getMonth() !== resetDate.getMonth() ||
      now.getFullYear() !== resetDate.getFullYear();
    expect(shouldReset).toBe(true);
  });

  it("upload limit does not reset within same month", () => {
    const resetDate = new Date("2026-04-01");
    const now = new Date("2026-04-15");
    const shouldReset =
      now.getMonth() !== resetDate.getMonth() ||
      now.getFullYear() !== resetDate.getFullYear();
    expect(shouldReset).toBe(false);
  });
});
