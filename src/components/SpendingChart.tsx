import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface SpendingChartProps {
  refreshKey?: number;
}

const SpendingChart = ({ refreshKey = 0 }: SpendingChartProps) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    fetchSpendingData();
  }, [refreshKey]);

  const fetchSpendingData = async () => {
    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('category, amount');

      if (error) throw error;

      // Group by category and sum amounts
      const categoryTotals: { [key: string]: number } = {};
      transactions?.forEach((t: any) => {
        const category = t.category || 'Other';
        categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(parseFloat(t.amount));
      });

      const chartData = Object.entries(categoryTotals).map(([name, value]) => ({
        name,
        value: parseFloat(value.toFixed(2)),
      }));

      setData(chartData);
    } catch (error) {
      console.error('Error fetching spending data:', error);
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
        ) : data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            {t("noDataAvailable")}
          </div>
        ) : (
          <ChartContainer
            config={{}}
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `£${value.toFixed(2)}`} />
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