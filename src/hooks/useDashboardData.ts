import { useState } from 'react';
import { useStatementData } from './useStatementData';
import { annualSubscriptionCost, availableMonths, currentMonth, summarizeTransactions } from '@/lib/analytics';

export const useDashboardData = (userId: string | undefined, refreshKey: number) => {
  const { transactions, subscriptions } = useStatementData(userId, refreshKey);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const rows = transactions.data || [];
  const months = availableMonths(rows);
  const month = selectedMonth || months[0] || currentMonth();
  const monthRows = rows.filter(row => row.date.startsWith(month));
  const summary = summarizeTransactions(monthRows);
  const active = (subscriptions.data || []).filter(sub => sub.status === 'active');
  return { ...summary, month, months, setSelectedMonth, hasTransactions: rows.length > 0,
    legacyTransactionsCount: monthRows.filter(row => !row.direction).length,
    subscriptionCount: active.length, annualCost: active.reduce((sum, sub) => sum + annualSubscriptionCost(sub), 0),
    loading: transactions.isPending || subscriptions.isPending,
    error: transactions.isError || subscriptions.isError,
    retry: () => { void transactions.refetch(); void subscriptions.refetch(); },
  };
};
