import { afterEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { canPurchaseInApp } from '../mobile-platform';
import { redirectToCheckout } from '../checkout-redirect';
afterEach(() => vi.restoreAllMocks());
describe('native companion billing boundary', () => {
  it('preserves web checkout', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    const assign = vi.fn();
    redirectToCheckout('https://checkout.stripe.com/c/pay/test', { assign });
    expect(assign).toHaveBeenCalledOnce();
    expect(canPurchaseInApp()).toBe(true);
  });
  it('blocks checkout and billing portal navigation in native builds', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    for (const host of ['checkout.stripe.com', 'billing.stripe.com']) {
      const assign = vi.fn();
      expect(() => redirectToCheckout(`https://${host}/session`, { assign })).toThrow('Purchases are not available');
      expect(assign).not.toHaveBeenCalled();
    }
    expect(canPurchaseInApp()).toBe(false);
  });
});
