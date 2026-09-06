import { Card, CardContent } from '@/components/ui/card';
import { money } from '@/lib/analytics';
interface Props { spending: number; income: number; subscriptionCount: number; annualCost: number; period: string; }
export default function DashboardSummaryCards({ spending, income, subscriptionCount, annualCost, period }: Props) {
  return <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 xl:grid-cols-4">
    {[['Money out', money(spending), period], ['Money in', money(income), period], ['Subscriptions to review', String(subscriptionCount), 'Currently marked active'], ['Estimated annual cost', money(annualCost), 'Active subscriptions · not guaranteed savings']].map(([label, value, detail]) => (
      <Card key={label}><CardContent className="p-5"><h2 className="text-sm text-muted-foreground">{label}</h2><p className="my-2 break-words text-2xl font-semibold tabular-nums tracking-tight">{value}</p><p className="text-xs leading-relaxed text-muted-foreground">{detail}</p></CardContent></Card>
    ))}
  </div>;
}
