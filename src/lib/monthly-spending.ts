export interface UploadHistoryRow {
  upload_date: string | Date | null | undefined;
  total_spending: number | string | null | undefined;
}

export interface MonthlySpendingPoint {
  /** Sort key, e.g. "2026-09" */
  key: string;
  /** Display label, e.g. "Sep 2026" */
  month: string;
  /** First day of the month */
  date: Date;
  /** Summed total_spending for the month */
  cost: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parses an upload date. Supports ISO/Date values plus a DD/MM/YYYY fallback.
 * Returns null for anything unparseable — never substitutes the current date.
 */
export function parseUploadDate(value: UploadHistoryRow['upload_date']): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // DD/MM/YYYY (UK) fallback takes precedence over Date's US interpretation.
  const uk = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (uk) {
    const day = Number(uk[1]);
    const month = Number(uk[2]);
    const year = Number(uk[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Groups upload-history rows into one point per calendar month, summing
 * total_spending, sorted chronologically. Rows with invalid dates are skipped.
 */
export function buildMonthlySpendingTrend(rows: UploadHistoryRow[] | null | undefined): MonthlySpendingPoint[] {
  const buckets = new Map<string, MonthlySpendingPoint>();

  for (const row of rows ?? []) {
    const date = parseUploadDate(row?.upload_date);
    if (!date) continue;

    const amount = Number(row?.total_spending);
    if (!Number.isFinite(amount)) continue;

    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;

    const existing = buckets.get(key);
    if (existing) {
      existing.cost += amount;
    } else {
      buckets.set(key, {
        key,
        month: `${MONTHS[month]} ${year}`,
        date: new Date(year, month, 1),
        cost: amount,
      });
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((point) => ({ ...point, cost: Math.round(point.cost * 100) / 100 }));
}
