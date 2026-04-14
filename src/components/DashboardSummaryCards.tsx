import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieChartIcon, TrendingDown } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DashboardSummaryCardsProps {
  monthlySpending: number;
  subscriptionCount: number;
  potentialSavings: number;
}

const DashboardSummaryCards = ({ monthlySpending, subscriptionCount, potentialSavings }: DashboardSummaryCardsProps) => {
  const { t } = useTranslation();

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("monthlySpending")}</CardTitle>
          <PieChartIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">£{monthlySpending.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">{monthlySpending === 0 ? t("uploadCsvToSeeData") : t("thisMonth")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("subscriptionLeaks")}</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{subscriptionCount}</div>
          <p className="text-xs text-muted-foreground">{t("detectedSubscriptions")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("potentialSavings")}</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">£{potentialSavings.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">{t("perYear")}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardSummaryCards;
