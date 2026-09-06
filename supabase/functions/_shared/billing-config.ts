import { STRIPE_TIERS } from './stripe-tiers.ts';

/** Sandbox defaults are never used with a live key. Prices are chosen by the server. */
export function billingConfig(env: Record<string, string | undefined>) {
  const key = env.STRIPE_SECRET_KEY_CUSTOM ?? '';
  const live = /^(sk|rk)_live_/.test(key);
  const test = /^(sk|rk)_test_/.test(key);
  if (!live && !test) throw new Error('A Stripe secret key is required');
  if (env.STRIPE_MODE && env.STRIPE_MODE !== (live ? 'live' : 'test')) throw new Error('Stripe key and mode disagree');
  const accountId = env.STRIPE_ACCOUNT_ID || (test ? 'acct_1SCrpvJMS012Ip2A' : '');
  const proPriceId = env.STRIPE_PRO_PRICE_ID || (test ? STRIPE_TIERS.pro.priceId : '');
  const premiumPriceId = env.STRIPE_PREMIUM_PRICE_ID || (test ? STRIPE_TIERS.premium.priceId : '');
  if (!/^acct_\w+$/.test(accountId) || !/^price_\w+$/.test(proPriceId)) throw new Error('Configure the Stripe account and Pro price');
  if (premiumPriceId && !/^price_\w+$/.test(premiumPriceId)) throw new Error('Invalid Premium price');
  if (proPriceId === premiumPriceId) throw new Error('Stripe tiers must use different prices');
  if (live && [proPriceId, premiumPriceId].some(price => Object.values(STRIPE_TIERS).some(tier => tier.priceId === price))) {
    throw new Error('Sandbox prices cannot be used for live billing');
  }
  const priceToTier: Record<string, string> = { [proPriceId]: 'pro' };
  if (premiumPriceId) priceToTier[premiumPriceId] = 'premium';
  return { key, live, accountId, proPriceId, priceToTier };
}

export type BillingConfig = ReturnType<typeof billingConfig>;

/** Accept old clients only when their price matches this environment. */
export function checkoutPrice(body: unknown, config: BillingConfig): string | null {
  if (!body || typeof body !== 'object') return null;
  const { tier, priceId } = body as { tier?: unknown; priceId?: unknown };
  if (tier !== undefined && tier !== 'pro') return null;
  if (priceId !== undefined && priceId !== config.proPriceId) return null;
  return tier === 'pro' || priceId === config.proPriceId ? config.proPriceId : null;
}
