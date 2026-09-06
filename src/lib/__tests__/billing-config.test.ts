import { describe, expect, it } from 'vitest';
import { billingConfig, checkoutPrice } from '../../../supabase/functions/_shared/billing-config';
import { billingState } from '../../../supabase/functions/_shared/billing-state';

describe('isolated Stripe environments', () => {
  const test = { STRIPE_SECRET_KEY_CUSTOM: 'sk_test_fixture' };
  const live = { STRIPE_SECRET_KEY_CUSTOM: 'sk_live_fixture', STRIPE_MODE: 'live', STRIPE_ACCOUNT_ID: 'acct_live_fixture', STRIPE_PRO_PRICE_ID: 'price_live_pro' };
  it('pins default test credentials to the verified Casher sandbox', () => {
    expect(billingConfig(test)).toMatchObject({ live: false, accountId: 'acct_1SCrpvJMS012Ip2A', proPriceId: 'price_1SYzJQJMS012Ip2AChBRKO5w' });
  });
  it('requires explicit account and price configuration for live keys', () => {
    expect(() => billingConfig({ STRIPE_SECRET_KEY_CUSTOM: 'sk_live_fixture' })).toThrow();
    expect(() => billingConfig({ ...live, STRIPE_PRO_PRICE_ID: billingConfig(test).proPriceId })).toThrow();
    expect(() => billingConfig({ ...live, STRIPE_MODE: 'test' })).toThrow();
    expect(() => billingConfig({ ...test, STRIPE_MODE: 'live' })).toThrow();
    expect(() => billingConfig({ STRIPE_SECRET_KEY_CUSTOM: 'pk_test_public' })).toThrow();
  });
  it('selects the server price and rejects Premium, forged and wrong-environment prices', () => {
    const config = billingConfig(live);
    expect(checkoutPrice({ tier: 'pro' }, config)).toBe('price_live_pro');
    expect(checkoutPrice({ priceId: 'price_live_pro' }, config)).toBe('price_live_pro');
    for (const body of [null, {}, { tier: 'premium' }, { tier: 'free' }, { tier: 'pro', priceId: 'price_forged' }, { priceId: billingConfig(test).proPriceId }]) {
      expect(checkoutPrice(body, config)).toBeNull();
    }
  });
  it('only grants access for the configured environment prices', () => {
    const sub = (id: string) => ({ id: 'sub_fixture', created: 1, status: 'active', items: { data: [{ price: { id } }] } });
    const config = billingConfig(live);
    expect(billingState([sub('price_live_pro')], config.priceToTier).subscription_tier).toBe('pro');
    expect(billingState([sub(billingConfig(test).proPriceId)], config.priceToTier).subscription_tier).toBe('free');
  });
});
