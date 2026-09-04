import { describe, it, expect } from 'vitest';
import { buildMonthlySpendingTrend, parseUploadDate } from '../monthly-spending';

describe('buildMonthlySpendingTrend', () => {
  it('aggregates multiple uploads in the same month into one point', () => {
    const result = buildMonthlySpendingTrend([
      { upload_date: '2026-09-02T10:00:00Z', total_spending: 289.08 },
      { upload_date: '2026-09-04T12:30:00Z', total_spending: 1079.92 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].month).toBe('Sep 2026');
    expect(result[0].cost).toBe(1369.0);
  });

  it('orders months chronologically across years', () => {
    const result = buildMonthlySpendingTrend([
      { upload_date: '2026-01-15', total_spending: 10 },
      { upload_date: '2025-12-01', total_spending: 20 },
      { upload_date: '2026-09-04', total_spending: 30 },
    ]);

    expect(result.map((p) => p.month)).toEqual(['Dec 2025', 'Jan 2026', 'Sep 2026']);
  });

  it('sums decimal totals without floating point drift', () => {
    const result = buildMonthlySpendingTrend([
      { upload_date: '2026-03-01', total_spending: 0.1 },
      { upload_date: '2026-03-02', total_spending: 0.2 },
      { upload_date: '2026-03-03', total_spending: '10.05' },
    ]);

    expect(result[0].cost).toBe(10.35);
  });

  it('supports the DD/MM/YYYY fallback', () => {
    const result = buildMonthlySpendingTrend([
      { upload_date: '04/09/2026', total_spending: 100 },
      { upload_date: '28/09/2026', total_spending: 50 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].month).toBe('Sep 2026');
    expect(result[0].cost).toBe(150);
  });

  it('skips invalid dates and non-numeric totals rather than guessing', () => {
    const result = buildMonthlySpendingTrend([
      { upload_date: 'not-a-date', total_spending: 999 },
      { upload_date: '32/13/2026', total_spending: 999 },
      { upload_date: null, total_spending: 999 },
      { upload_date: '2026-05-01', total_spending: 'abc' },
      { upload_date: '2026-05-01', total_spending: 42 },
    ]);

    expect(result).toEqual([
      expect.objectContaining({ month: 'May 2026', cost: 42 }),
    ]);
  });

  it('returns an empty series for no rows', () => {
    expect(buildMonthlySpendingTrend([])).toEqual([]);
    expect(buildMonthlySpendingTrend(null)).toEqual([]);
  });
});

describe('parseUploadDate', () => {
  it('parses ISO strings and Date objects', () => {
    expect(parseUploadDate('2026-09-04')?.getFullYear()).toBe(2026);
    expect(parseUploadDate(new Date(2026, 8, 4))?.getMonth()).toBe(8);
  });

  it('prefers UK day-first order for slash dates', () => {
    const d = parseUploadDate('04/09/2026');
    expect(d?.getMonth()).toBe(8);
    expect(d?.getDate()).toBe(4);
  });

  it('returns null for invalid input', () => {
    expect(parseUploadDate('rubbish')).toBeNull();
    expect(parseUploadDate(undefined)).toBeNull();
  });
});
