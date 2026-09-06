import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { money } from "@/lib/analytics";
import { Button } from './ui/button';

interface UploadHistoryProps {
  userId?: string;
  refreshKey?: number;
}

interface UploadRecord {
  id: string;
  upload_date: string;
  total_spending: number;
  subscriptions_count: number;
  potential_savings: number;
  transaction_count: number;
}

const UploadHistory = ({ userId, refreshKey = 0 }: UploadHistoryProps) => {
  const [history, setHistory] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      setFailed(false);
      setLoading(true);
      if (!userId) {
        setHistory([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('upload_history')
        .select('*')
        .eq('user_id', userId)
        .order('upload_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      setFailed(true);
      console.error('Error fetching upload history:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchHistory();
    // refreshKey forces a refetch after a new upload.
  }, [fetchHistory, refreshKey]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent imports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (failed) return <Card><CardHeader><CardTitle>Recent imports</CardTitle></CardHeader><CardContent role="alert"><p>Import history could not be loaded.</p><Button variant="outline" onClick={fetchHistory}>Try again</Button></CardContent></Card>;

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent imports
          </CardTitle>
          <CardDescription>Your upload history will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No previous uploads yet. Upload your first CSV to get started!
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Recent imports
        </CardTitle>
        <CardDescription>Your 10 most recent uploads. Amounts are snapshots from each import.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {history.map((record) => (
            <div
              key={record.id}
                className="flex items-center justify-between py-4 border-b last:border-0"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {format(new Date(record.upload_date), 'MMM dd, yyyy')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div>
                    <span className="font-semibold text-foreground">{money(Number(record.total_spending))}</span> spent
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">{record.transaction_count}</span> transactions
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">{record.subscriptions_count}</span> subscriptions
                  </div>

                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default UploadHistory;
