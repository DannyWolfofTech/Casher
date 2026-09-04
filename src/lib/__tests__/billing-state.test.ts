import { describe, expect, it } from 'vitest';
import { billingState, hasUnfinishedSubscription } from '../../../supabase/functions/_shared/billing-state';
import { isPurchasablePriceId } from '../../../supabase/functions/_shared/stripe-guard';
import { STRIPE_TIERS } from '../../../supabase/functions/_shared/stripe-tiers';
const subscription = (status: string, created = 1, price: string = STRIPE_TIERS.pro.priceId) => ({ id: `sub_${created}`, status, created, items: { data: [{ price: { id: price }, current_period_end: 1788480000 }] } });
describe('billing reconciliation', () => {
  it('does not let a newer cancelled or unknown plan remove an active entitlement', () => {
    expect(billingState([subscription('active'), subscription('canceled', 3), subscription('active', 4, 'price_other')])).toMatchObject({ subscription_tier: 'pro', subscription_status: 'active' });
  });
  it('matches trial, overdue, recovered, cancelled and no-plan states', () => {
    for (const status of ['active', 'trialing']) expect(billingState([subscription(status)]).subscription_tier).toBe('pro');
    for (const status of ['past_due', 'unpaid', 'canceled', 'incomplete', 'paused']) expect(billingState([subscription(status)]).subscription_tier).toBe('free');
    expect(billingState([])).toEqual({ subscription_tier: 'free', subscription_status: 'inactive', current_period_end: null });
  });
  it('reads billing period from the current Stripe item schema', () => {
    expect(billingState([subscription('active')]).current_period_end).toBe(new Date(1788480000 * 1000).toISOString());
  });
  it('routes all unfinished billing states away from a second checkout', () => {
    for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']) expect(hasUnfinishedSubscription([subscription(status)])).toBe(true);
    expect(hasUnfinishedSubscription([subscription('canceled'), subscription('incomplete_expired')])).toBe(false);
  });
  it('blocks direct purchases of the unfinished Premium product', () => {
    expect(isPurchasablePriceId(STRIPE_TIERS.pro.priceId)).toBe(true);
    expect(isPurchasablePriceId(STRIPE_TIERS.premium.priceId)).toBe(false);
    expect(isPurchasablePriceId('price_forged')).toBe(false);
  });
});
