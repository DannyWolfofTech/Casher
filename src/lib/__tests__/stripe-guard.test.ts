import { describe, expect, it } from "vitest";
import {
  ALLOWED_PRICE_IDS,
  CANONICAL_ORIGIN,
  entitlementForSubscription,
  isAllowedOrigin,
  isAllowedPriceId,
  safeReturnOrigin,
} from "../../../supabase/functions/_shared/stripe-guard";
import { STRIPE_TIERS } from "@/config/stripe";

const PRICE_TO_TIER: Record<string, string> = {
  [STRIPE_TIERS.pro.priceId]: "pro",
  [STRIPE_TIERS.premium.priceId]: "premium",
};

describe("price allowlist", () => {
  it("stays in sync with the frontend tier config", () => {
    expect([...ALLOWED_PRICE_IDS].sort()).toEqual(
      [STRIPE_TIERS.pro.priceId, STRIPE_TIERS.premium.priceId].sort(),
    );
  });

  it("accepts known prices", () => {
    expect(isAllowedPriceId(STRIPE_TIERS.pro.priceId)).toBe(true);
  });

  it("fails closed on anything else", () => {
    expect(isAllowedPriceId("price_attacker")).toBe(false);
    expect(isAllowedPriceId("")).toBe(false);
    expect(isAllowedPriceId(undefined)).toBe(false);
    expect(isAllowedPriceId({ priceId: STRIPE_TIERS.pro.priceId })).toBe(false);
  });
});

describe("safeReturnOrigin", () => {
  it("allows the canonical site", () => {
    expect(safeReturnOrigin("https://trycasher.com")).toBe("https://trycasher.com");
  });

  it.each([
    "https://id-preview--ea77ebbb-78bd-46c4-a0c9-0ab73994a416.lovable.app",
    "https://preview--trycasher-com.lovable.app",
    "https://ea77ebbb-78bd-46c4-a0c9-0ab73994a416.lovableproject.com",
    "https://www.trycasher.com",
    "http://localhost:8080",
  ])("allows the exact Casher origin %s", (origin) => {
    expect(safeReturnOrigin(origin)).toBe(origin);
  });

  it("rejects arbitrary Lovable projects", () => {
    for (const origin of [
      "https://someone-elses-app.lovable.app",
      "https://id-preview--00000000-0000-0000-0000-000000000000.lovable.app",
      "https://attacker.lovableproject.com",
    ]) {
      expect(isAllowedOrigin(origin)).toBe(false);
      expect(safeReturnOrigin(origin)).toBe(CANONICAL_ORIGIN);
    }
  });

  it("rejects a forged origin and falls back to canonical", () => {
    expect(safeReturnOrigin("https://evil.example.com")).toBe(CANONICAL_ORIGIN);
    expect(safeReturnOrigin("https://trycasher.com.evil.com")).toBe(CANONICAL_ORIGIN);
    expect(safeReturnOrigin("https://evil.lovable.app.attacker.net")).toBe(CANONICAL_ORIGIN);
    expect(safeReturnOrigin("https://preview--trycasher-com.lovable.app.evil.net")).toBe(
      CANONICAL_ORIGIN,
    );
  });

  it("falls back on missing or malformed headers", () => {
    expect(safeReturnOrigin(null)).toBe(CANONICAL_ORIGIN);
    expect(safeReturnOrigin("not a url")).toBe(CANONICAL_ORIGIN);
  });

  it("strips paths from a referer-style value", () => {
    expect(safeReturnOrigin("https://trycasher.com/pricing?x=1")).toBe("https://trycasher.com");
  });

  it("honours an explicit extra allowlist", () => {
    expect(isAllowedOrigin("https://staging.trycasher.com")).toBe(false);
    expect(safeReturnOrigin("https://staging.trycasher.com", "https://staging.trycasher.com/")).toBe(
      "https://staging.trycasher.com",
    );
  });
});

describe("entitlementForSubscription", () => {
  it("grants the mapped tier while active or trialing", () => {
    expect(entitlementForSubscription("active", STRIPE_TIERS.pro.priceId, PRICE_TO_TIER)).toEqual({
      subscription_tier: "pro",
      subscription_status: "active",
    });
    expect(
      entitlementForSubscription("trialing", STRIPE_TIERS.premium.priceId, PRICE_TO_TIER),
    ).toEqual({ subscription_tier: "premium", subscription_status: "active" });
  });

  it("revokes the paid tier on failed payments", () => {
    for (const status of ["past_due", "unpaid"]) {
      expect(entitlementForSubscription(status, STRIPE_TIERS.pro.priceId, PRICE_TO_TIER)).toEqual({
        subscription_tier: "free",
        subscription_status: "past_due",
      });
    }
  });

  it("revokes on cancellation and expiry", () => {
    for (const status of ["canceled", "incomplete_expired"]) {
      expect(entitlementForSubscription(status, STRIPE_TIERS.premium.priceId, PRICE_TO_TIER)).toEqual(
        { subscription_tier: "free", subscription_status: "canceled" },
      );
    }
  });

  it("never grants a tier for an unknown price", () => {
    expect(entitlementForSubscription("active", "price_unknown", PRICE_TO_TIER)).toEqual({
      subscription_tier: "free",
      subscription_status: "active",
    });
    expect(entitlementForSubscription("active", undefined, PRICE_TO_TIER).subscription_tier).toBe(
      "free",
    );
  });

  it("defaults unknown Stripe statuses to inactive/free", () => {
    expect(entitlementForSubscription("paused", STRIPE_TIERS.pro.priceId, PRICE_TO_TIER)).toEqual({
      subscription_tier: "free",
      subscription_status: "inactive",
    });
  });
});
