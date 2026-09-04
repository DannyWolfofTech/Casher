import { describe, expect, it } from 'vitest';
import { annualSubscriptionCost, summarizeTransactions, transactionTrend, safeExternalUrl } from '../analytics';
import { readAllPages } from '../pagination';

describe('statement analytics', () => {
  it('reconciles categories to money out, excludes credits, and preserves pence', () => {
    const rows = [{ id: 'a', date: '2026-08-01', amount: -0.1, direction: 'debit' as const, category: 'Food' }, { id: 'b', date: '2026-08-02', amount: -0.2, direction: 'debit' as const, category: 'Food' }, { id: 'c', date: '2026-08-02', amount: 900, direction: 'credit' as const, category: 'Income' }];
    expect(summarizeTransactions(rows)).toEqual({ spending: 0.3, income: 900, categories: [{ name: 'Food', value: 0.3 }] });
  });
  it('uses transaction months, keeps years separate, and does not invent missing months', () => {
    const rows = [{ id: '1', date: '2025-12-01', amount: -20 }, { id: '2', date: '2026-02-01', amount: -30 }];
    expect(transactionTrend(rows).map(p => [p.key, p.spending])).toEqual([['2025-12', 20], ['2026-02', 30]]);
  });
  it('uses the same annual basis for monthly, annual, yearly and weekly subscriptions', () => {
    expect(['monthly', 'annual', 'yearly', 'weekly'].map(frequency => annualSubscriptionCost({ amount: 10, frequency }))).toEqual([120, 10, 10, 520]);
    expect(annualSubscriptionCost({ amount: -10, frequency: 'monthly' })).toBe(0);
  });
  it('rejects executable and credential-bearing provider links', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://user:secret@example.com', 'http://example.com']) expect(safeExternalUrl(url)).toBeNull();
    expect(safeExternalUrl('https://example.com/cancel')).toBe('https://example.com/cancel');
  });
});
describe('complete pagination', () => {
  it('reads beyond 1,000 rows even if the API applies a smaller page cap', async () => {
    const data = Array.from({ length: 1205 }, (_, i) => i);
    const result = await readAllPages((from) => Promise.resolve({ data: data.slice(from, from + 100), error: null, count: 1205 }));
    expect(result).toEqual(data);
  });
  it('rejects a failed later page instead of returning partial totals', async () => {
    await expect(readAllPages(from => Promise.resolve(from === 0 ? { data: [1, 2], error: null, count: 4 } : { data: null, error: new Error('offline') }), 2)).rejects.toThrow('offline');
  });
  it('rejects an incomplete response', async () => {
    await expect(readAllPages(() => Promise.resolve({ data: [], error: null, count: 10 }))).rejects.toThrow('Incomplete');
  });
});
