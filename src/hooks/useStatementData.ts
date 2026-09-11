import { readRequest, retryRead } from '@/lib/read-request';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { readAllPages } from '@/lib/pagination';

export function useStatementData(userId?: string, refreshKey = 0) {
  const transactions = useQuery({
    queryKey: ['transactions', userId, refreshKey], enabled: !!userId, retry: retryRead, staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const rows = await readRequest(readSignal => readAllPages((from, to) => supabase.from('transactions').select('*', { count: 'exact' }).eq('user_id', userId!).order('date', { ascending: false }).order('id').range(from, to).abortSignal(readSignal).retry(false)), signal);
      return rows.map(row => {
        const direction = row.direction_override ?? row.direction;
        if (direction != null && direction !== 'debit' && direction !== 'credit') throw new Error('Unrecognised transaction direction');
        return { ...row, category: row.category_override ?? row.category, direction: direction as 'debit' | 'credit' | null };
      });
    },
  });
  const subscriptions = useQuery({
    queryKey: ['subscriptions', userId, refreshKey], enabled: !!userId, retry: retryRead, staleTime: 60_000,
    queryFn: ({ signal }) => readRequest(readSignal => readAllPages((from, to) => supabase.from('detected_subscriptions').select('*', { count: 'exact' }).eq('user_id', userId!).order('id').range(from, to).abortSignal(readSignal).retry(false)), signal),
  });
  return { transactions, subscriptions };
}
