import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { captureApiError } from "@/lib/sentry";
import { sumCredits, sumSpending, type DirectionalTransaction } from "@/lib/transactions";


export const useDashboardData = (userId: string | undefined, refreshKey: number) => {
  const [monthlySpending, setMonthlySpending] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [potentialSavings, setPotentialSavings] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    if (!userId) return;
    try {
      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const endOfMonthStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startOfMonth)
        .lte('date', endOfMonthStr);

      // Legacy rows have no direction and stay counted as spending.
      const rows = (transactions ?? []) as unknown as DirectionalTransaction[];
      setMonthlySpending(sumSpending(rows));
      setMonthlyIncome(sumCredits(rows));


      const { data: subscriptions } = await supabase
        .from('detected_subscriptions')
        .select('amount, estimated_annual_cost')
        .eq('user_id', userId)
        .eq('status', 'active');

      setSubscriptionCount(subscriptions?.length || 0);
      const savings = subscriptions?.reduce((sum, s) => sum + (Number(s.estimated_annual_cost) || 0), 0) || 0;
      setPotentialSavings(savings);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      captureApiError(error, { operation: 'fetchDashboardData' });
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchDashboardData();
    // refreshKey forces a refetch after a new upload.
  }, [fetchDashboardData, refreshKey, userId]);

  return { monthlySpending, monthlyIncome, subscriptionCount, potentialSavings };
};
