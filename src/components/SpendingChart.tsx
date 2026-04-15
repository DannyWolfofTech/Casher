import { useEffect, useState } from "react";
import { captureApiError } from "@/lib/sentry";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface SpendingChartProps {
  refreshKey?: number;
}

const SpendingChart = ({ refreshKey = 0 }: SpendingChartProps) => {
  const [data, setData] = useState<Array<{ name: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    fetchSpendingData();
  }, [refreshKey]);

  const fetchSpendingData = async () => {
    try {
      setError(false);
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const endOfMonthStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('category, amount')
        .eq('user_id', user.id)
        .gte('date', startOfMonth)
        .lte('date', endOfMonthStr);

      if (error) throw error;

      // Group by category and sum amounts
      const categoryTotals: { [key: string]: number } = {};
      (transactions || []).forEach((t) => {
        const category = t.category || 'Other';
        categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(parseFloat(String(t.amount)));
      });

      const chartData = Object.entries(categoryTotals)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({
          name,
          value: parseFloat(value.toFixed(2)),
        }));

      setData(chartData);
    } catch (err) {
      console.error('Error fetching spending data:', err);
      captureApiError(err, { operation: 'fetchSpendingData' });
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("spendingByCategory")}</CardTitle>
        <CardDescription>{t("overallSpendingBreakdown")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            {t("loading")}
          </div>
        ) : error ? (
          <div className="h-[300px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm">{t("failedToLoadData")}</p>
            <Button variant="outline" size="sm" onClick={fetchSpendingData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("retry")}
            </Button>
          </div>
        ) : data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            {t("noDataAvailable")}
          </div>
        ) : (
          <ChartContainer config={{}} className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="45%"
                  labelLine={true}
                  label={({ name, value, cx, cy, midAngle, outerRadius }) => {
                    const RADIAN = Math.PI / 180;
                    const radius = outerRadius + 30;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text
                        x={x}
                        y={y}
                        fill="currentColor"
                        textAnchor={x > cx ? 'start' : 'end'}
                        dominantBaseline="central"
                        fontSize={11}
                      >
                        {`${name} £${value.toFixed(0)}`}
                      </text>
                    );
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`£${value.toFixed(2)}`, 'Amount']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default SpendingChart;
