import { creditAmount, spendingAmount, type DirectionalTransaction } from './transactions';

export interface StatementTransaction extends DirectionalTransaction { id: string; date: string; }
export interface CategoryAmount { name: string; value: number; }
export const money = (amount: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
export const currentMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; };
export const monthLabel = (month: string, locale = 'en-GB') => new Date(`${month}-01T12:00:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
export const monthKey = (date: string) => /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date) ? date.slice(0, 7) : null;
export function availableMonths(rows: StatementTransaction[]) {
  return [...new Set(rows.map(row => monthKey(row.date)).filter((key): key is string => !!key))].sort().reverse();
}
export function summarizeTransactions(rows: StatementTransaction[]) {
  const categories = new Map<string, number>();
  let out = 0; let incoming = 0;
  for (const row of rows) {
    const debit = Math.round(spendingAmount(row) * 100);
    out += debit; incoming += Math.round(creditAmount(row) * 100);
    if (debit > 0) {
      const name = row.category?.trim() || 'Other';
      categories.set(name, (categories.get(name) || 0) + debit);
    }
  }
  return { spending: out / 100, income: incoming / 100, categories: [...categories].map(([name, cents]) => ({ name, value: cents / 100 })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)) };
}
export function transactionTrend(rows: StatementTransaction[]) {
  return availableMonths(rows).reverse().map(key => ({ key, month: monthLabel(key), ...summarizeTransactions(rows.filter(row => monthKey(row.date) === key)) }));
}
export function annualSubscriptionCost(sub: { amount: number | string; frequency: string; estimated_annual_cost?: number | null }) {
  const multiplier: Record<string, number> = { monthly: 12, annual: 1, annually: 1, yearly: 1, weekly: 52, fortnightly: 26, quarterly: 4 };
  const amount = Number(sub.amount);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const factor = multiplier[sub.frequency.toLowerCase()];
  const estimate = factor ? amount * factor : Number(sub.estimated_annual_cost);
  return Number.isFinite(estimate) && estimate > 0 ? Math.round(estimate * 100) / 100 : 0;
}
export function safeExternalUrl(value: string | null | undefined): string | null {
  try { const url = new URL(value || ''); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
