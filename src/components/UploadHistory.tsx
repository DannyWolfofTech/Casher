import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingDown, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

  useEffect(() => {
    fetchHistory();
  }, [userId, refreshKey]);

  const fetchHistory = async () => {
    try {
      const isTestMode = localStorage.getItem('casher_test_mode') === 'true';
      
      if (isTestMode) {
        const testHistory = JSON.parse(localStorage.getItem('test_upload_history') || '[]');
        setHistory(testHistory);
      } else {
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
      }
    } catch (error) {
      console.error('Error fetching upload history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Previous Analyses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Previous Analyses
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
          Previous Analyses
        </CardTitle>
        <CardDescription>View your past CSV uploads and insights</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {history.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {format(new Date(record.upload_date), 'MMM dd, yyyy')}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                  <div>
                    <span className="font-semibold text-foreground">£{parseFloat(String(record.total_spending)).toFixed(2)}</span> spent
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">{record.transaction_count}</span> transactions
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">{record.subscriptions_count}</span> subscriptions
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-green-600" />
                    <span className="font-semibold text-green-600">£{parseFloat(String(record.potential_savings)).toFixed(2)}</span> potential savings
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
