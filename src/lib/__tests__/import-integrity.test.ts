import { describe, expect, it } from 'vitest';
import { parseAmount, parseTransactionsCsv, buildSubscriptions, resolveAmount } from '../../../supabase/functions/_shared/csv-parser';
describe('statement integrity', () => {
  it('rejects an unfinished quoted field instead of silently dropping the rest of the file', () => {
    expect(parseTransactionsCsv('Date,Description,Amount\n01/09/2026,"Shop,-12')).toMatchObject({ ok: false, code: 'INVALID_CSV' });
  });
  it('does not salvage numbers from corrupt input', () => {
    for (const input of ['abc123', '12.34.56', '1e3', 'Infinity', '12.123', '100000000']) expect(parseAmount(input)).toBeNaN();
    expect(parseAmount('12.34-')).toBe(-12.34);
    expect(parseAmount('-12.34 DR')).toBe(-12.34);
  });
  it('rejects ambiguous debit/credit cells', () => {
    expect(resolveAmount('', '12', '30', '')).toBeNull();
    expect(resolveAmount('', 'bad', '30', '')).toBeNull();
  });
  it('rejects currencies it cannot convert', () => {
    for (const csv of ['Date,Description,Amount,Currency\n01/09/2026,Shop,-12,USD', 'Date,Description,Amount\n01/09/2026,Shop,-€12']) {
      expect(parseTransactionsCsv(csv)).toMatchObject({ ok: false, code: 'UNSUPPORTED_CURRENCY' });
    }
  });
  it('uses the latest subscription charge regardless of file order', () => {
    const result = parseTransactionsCsv('Date,Description,Amount\n01/08/2026,Netflix,-10\n01/09/2026,Netflix,-15');
    if (!result.ok) throw new Error('Parse failed');
    expect([...buildSubscriptions(result.transactions).values()][0]).toMatchObject({ amount: 15, last_charged: '2026-09-01', estimated_annual_cost: 180 });
  });
});
