import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import CategoryChart from './CategoryChart';
import type { CategoryAmount } from '@/lib/analytics';

export default function SpendingChart({ data, period }: { data: CategoryAmount[]; period: string }) {
  const { t } = useTranslation();
  return <Card className="min-w-0">
    <CardHeader><CardTitle>{t('spendingByCategory')}</CardTitle><CardDescription>{period} · Money out from imported statements</CardDescription></CardHeader>
    <CardContent><CategoryChart data={data} label={`Spending by category for ${period}`} /></CardContent>
  </Card>;
}
