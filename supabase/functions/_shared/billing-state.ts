import { entitlementForSubscription } from './stripe-guard.ts';
import { PRICE_ID_TO_TIER } from './stripe-tiers.ts';

export interface BillingSubscription {
  id: string;
  created: number;
  status: string;
  items: { data: { price: { id: string }; current_period_end?: number }[] };
}

/** Reconcile the complete current customer state, including a second active plan. */
export function billingState(subscriptions: BillingSubscription[]) {
  const ranked = subscriptions.map(subscription => {
    const item = subscription.items.data.find(item => PRICE_ID_TO_TIER[item.price.id]);
    const entitlement = entitlementForSubscription(subscription.status, item?.price.id, PRICE_ID_TO_TIER);
    const rank = entitlement.subscription_tier === 'premium' ? 2 : entitlement.subscription_tier === 'pro' ? 1 : 0;
    return { subscription, item, entitlement, rank };
  }).sort((a, b) => b.rank - a.rank || b.subscription.created - a.subscription.created);
  const best = ranked[0];
  return {
    ...(best?.entitlement ?? { subscription_tier: 'free', subscription_status: 'inactive' }),
    current_period_end: best?.item?.current_period_end ? new Date(best.item.current_period_end * 1000).toISOString() : null,
  };
}

export function hasUnfinishedSubscription(subscriptions: BillingSubscription[]) {
  return subscriptions.some(subscription => !['canceled', 'incomplete_expired'].includes(subscription.status));
}
