import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { captureApiError } from "@/lib/sentry";
import { sumCredits, sumSpending, type DirectionalTransaction } from "@/lib/transactions";


export const useDashboardData = (userId: string | undefined, refreshKey: number) => {
  const [monthlySpending, setMonthlySpending] = useState(0);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [potentialSavings, setPotentialSavings] = useState(0);

  useEffect(() => {
    if (!userId) return;
    fetchDashboardData();
  }, [refreshKey, userId]);

  const fetchDashboardData = async () => {
    if (!userId) return;
    try {
      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const endOfMonthStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .gte('date', startOfMonth)
        .lte('date', endOfMonthStr);

      const total = transactions?.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0;
      setMonthlySpending(total);

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
  };

  return { monthlySpending, subscriptionCount, potentialSavings };
};
