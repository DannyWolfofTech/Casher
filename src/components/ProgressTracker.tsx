import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProgressTrackerProps {
  userId?: string;
  currentMonthSpending: number;
  refreshKey?: number;
}

const ProgressTracker = ({ userId, currentMonthSpending, refreshKey = 0 }: ProgressTrackerProps) => {
  const [previousMonthSpending, setPreviousMonthSpending] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPreviousMonth();
  }, [userId, refreshKey]);

  const fetchPreviousMonth = async () => {
    try {
      if (!userId) return;
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('monthly_spending_history')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileData?.monthly_spending_history) {
        const history = profileData.monthly_spending_history as Array<{ month: string; spending: number }>;
        if (history.length > 0) {
          const sortedHistory = history.sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime());
          setPreviousMonthSpending(sortedHistory[0].spending);
        }
      }
    } catch (error) {
      console.error('Error fetching previous month data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || previousMonthSpending === null) {
    return null;
  }

  const difference = currentMonthSpending - previousMonthSpending;
  const percentageChange = previousMonthSpending > 0 
    ? ((difference / previousMonthSpending) * 100).toFixed(1)
    : 0;
  const isSaving = difference < 0;

  return (
    <Card className={isSaving ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : "border-red-500/50 bg-red-50/50 dark:bg-red-950/20"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isSaving ? (
            <TrendingUp className="h-5 w-5 text-green-600" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-600" />
          )}
          Your Progress
        </CardTitle>
        <CardDescription>This month vs Last month</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Current Month</p>
            <p className="text-2xl font-bold">£{currentMonthSpending.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Previous Month</p>
            <p className="text-2xl font-bold">£{previousMonthSpending.toFixed(2)}</p>
          </div>
        </div>
        
        <div className={`p-4 rounded-lg ${isSaving ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
          <p className={`text-lg font-semibold ${isSaving ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {isSaving ? (
              <>You saved £{Math.abs(difference).toFixed(2)} compared to last month! 🎉</>
            ) : (
              <>You spent £{Math.abs(difference).toFixed(2)} more this month</>
            )}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {isSaving ? 'Up' : 'Down'} {Math.abs(Number(percentageChange))}% from last month
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgressTracker;
