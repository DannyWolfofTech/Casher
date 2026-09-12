import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assets from '@/assets/merchants/catalogue.json';
import { matchesMerchantSearch, merchantCategory, resolveMerchant } from '../merchant-identity';
import { formatSignedAmount, sumCredits, sumSpending } from '../transactions';
import { cancellationProvider } from '../subscription-renewals';

describe('merchant display identities', () => {
  it.each([
    ['TESCO STORES 1234', 'tesco'], ['NETFLIX.COM', 'netflix'], ['  pure gym ltd  ', 'puregym'],
    ['PAYPAL *SPOTIFY', 'spotify'], ['PP*NETFLIX.COM', 'netflix'], ['CARD PAYMENT TO TESCO EXPRESS 19', 'tesco'],
    ['DEBIT CARD PURCHASE PAYPAL *SPOTIFY UK', 'spotify'], ['DIRECT DEBIT PURE GYM LTD', 'puregym'],
    ['SUMUP *STARBUCKS', 'starbucks'], ['SQ *LIDL GB', 'lidl'], ['UBER *EATS', 'ubereats'],
    ['UBER *TRIP HELP.UBER.COM', 'uber'], ['APPLE MUSIC', 'applemusic'], ['APPLE.COM/BILL', 'apple'],
    ['ITUNES.COM/BILL', 'apple'], ['ALDI SÜD', 'aldisud'], ['ALDI SUED', 'aldisud'],
    ['ALDI NORD 123', 'aldinord'], ['H&M 004', 'handm'], ['McDonald’s 123', 'mcdonalds'],
    ['GOOGLE *YOUTUBE PREMIUM', 'youtube'], ['BOOKING.COM HOTEL', 'bookingdotcom'],
    ['ＴＥＳＣＯ STORES', 'tesco'], ['O2 UK', 'o2'], ['BOOTS THE CHEMIST', 'boots'],
  ])('recognises %s as %s', (description, id) => {
    expect(resolveMerchant(description)?.id).toBe(id);
  });

  it.each([
    '', 'ALDI', 'GYM MEMBERSHIP', 'FITNESS CLUB', 'PAYPAL', 'SUMUP', 'SPOTIFYING', 'TESCOLOGY',
    'THE APPLE TREE CAFE', 'APPLE TREE CAFE', 'BOOTS AND SHOES', 'MORRISON J', 'HMRC',
    'O2 FITNESS', 'NETFLIX AND SPOTIFY', 'NETFLIX.COM.EVIL', 'UNKNOWN *NETFLIX',
    'https://example.test/NETFLIX', 'CORNER SHOP 84', 'UBERSON TRANSPORT', 'POSSE TESCO',
    'NETFLIX' + 'X'.repeat(513),
  ])('does not invent an identity for %s', description => {
    expect(resolveMerchant(description)).toBeNull();
  });

  it('only uses merchant metadata when it does not conflict with a meaningful description', () => {
    expect(resolveMerchant('DD 0123456', 'PureGym')?.id).toBe('puregym');
    expect(resolveMerchant(null, 'Netflix')?.id).toBe('netflix');
    expect(resolveMerchant('NETFLIX.COM', 'Netflix')?.id).toBe('netflix');
    expect(resolveMerchant('NETFLIX.COM', 'Spotify')).toBeNull();
    expect(resolveMerchant('The Apple Tree Cafe', 'Apple')).toBeNull();
    expect(resolveMerchant('X'.repeat(513), 'Apple')).toBeNull();
  });

  it('keeps original financial fields, sign and provider-link rules intact', () => {
    const debit = Object.freeze({ description: 'PAYPAL *NETFLIX', merchant: 'PAYPAL *NETFLIX', category: 'Shopping', direction: 'debit' as const, amount: -12.99 });
    const refund = Object.freeze({ ...debit, direction: 'credit' as const, amount: 12.99 });
    expect(resolveMerchant(debit.description, debit.merchant)?.id).toBe('netflix');
    expect(resolveMerchant(refund.description, refund.merchant)?.id).toBe('netflix');
    expect(debit.description).toBe('PAYPAL *NETFLIX');
    expect(debit.category).toBe('Shopping');
    expect(formatSignedAmount(debit)).toBe('-£12.99');
    expect(formatSignedAmount(refund)).toBe('+£12.99');
    expect(sumCredits([debit, refund])).toBe(12.99);
    expect(sumSpending([debit, refund])).toBe(12.99);
    expect(cancellationProvider(debit.description)).toBeNull();
  });

  it('searches the canonical name and original descriptor without treating punctuation as an empty query', () => {
    const row = { description: 'PURE GYM LTD 0123', merchant: 'PURE GYM', category: 'Fitness' };
    for (const query of ['PureGym', 'pure gym', '0123', 'fitness', '']) expect(matchesMerchantSearch(row, query)).toBe(true);
    expect(matchesMerchantSearch(row, '(),%_')).toBe(false);
    expect(matchesMerchantSearch(row, 'Netflix')).toBe(false);
  });

  it('uses known categories and a safe default for custom or missing categories', () => {
    expect(merchantCategory(' Groceries ')).toBe('groceries');
    expect(merchantCategory('Income')).toBe('income');
    expect(merchantCategory('Subscriptions')).toBe('subscription');
    expect(merchantCategory('Custom customer category')).toBe('other');
    expect(merchantCategory(null)).toBe('other');
  });

  it('ships every catalogue entry as an exact, local, versioned PNG', () => {
    const sources = JSON.parse(readFileSync('public/merchants/sources.json', 'utf8'));
    expect(Object.keys(assets)).toHaveLength(32);
    for (const [id, entry] of Object.entries(assets)) {
      expect(resolveMerchant(entry.name)?.id).toBe(id);
      expect(entry.asset).toMatch(/^[a-z0-9]+-[a-f0-9]{10}\.png$/);
      const bytes = readFileSync(`public/merchants/${entry.asset}`);
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      const source = sources.assets.find((s: { id: string }) => s.id === id);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
      expect(createHash('sha1').update(bytes).digest('hex')).toBe(source.figmaImageHash);
    }
  });
});
