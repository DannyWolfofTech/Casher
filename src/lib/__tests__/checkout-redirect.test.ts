import { describe, it, expect, vi } from "vitest";
import { isValidCheckoutUrl, redirectToCheckout } from "../checkout-redirect";

describe("isValidCheckoutUrl", () => {
  it("accepts Stripe hosted checkout URLs", () => {
    expect(isValidCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_123")).toBe(true);
    expect(isValidCheckoutUrl("https://billing.stripe.com/p/session/live_123")).toBe(true);
  });

  it("rejects missing, non-https, or non-Stripe URLs", () => {
    expect(isValidCheckoutUrl(undefined)).toBe(false);
    expect(isValidCheckoutUrl("")).toBe(false);
    expect(isValidCheckoutUrl("not a url")).toBe(false);
    expect(isValidCheckoutUrl("http://checkout.stripe.com/c/pay/1")).toBe(false);
    expect(isValidCheckoutUrl("https://checkout.stripe.com.evil.test/c/pay/1")).toBe(false);
    expect(isValidCheckoutUrl("https://someone:password@checkout.stripe.com/c/pay/1")).toBe(false);
    expect(isValidCheckoutUrl("https://checkout.stripe.com:8080/c/pay/1")).toBe(false);
  });
});

describe("redirectToCheckout", () => {
  it("navigates in the same tab on success", () => {
    const assign = vi.fn();
    redirectToCheckout("https://checkout.stripe.com/c/pay/cs_test_123", { assign });
    expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test_123");
  });

  it("throws a meaningful error when the URL is missing", () => {
    const assign = vi.fn();
    expect(() => redirectToCheckout(undefined, { assign })).toThrow(/missing or invalid/i);
    expect(assign).not.toHaveBeenCalled();
  });

  it("throws a meaningful error when navigation is blocked", () => {
    const assign = vi.fn(() => {
      throw new Error("blocked");
    });
    expect(() => redirectToCheckout("https://checkout.stripe.com/c/pay/x", { assign })).toThrow(
      /pop-up or redirect blockers/i,
    );
  });
});
