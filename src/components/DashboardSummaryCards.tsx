import { Card, CardContent } from '@/components/ui/card';
import { isNativeApp } from '@/lib/mobile-platform';
import { money } from '@/lib/analytics';
interface Props { spending: number; income: number; subscriptionCount: number; annualCost: number; period: string; }
export default function DashboardSummaryCards({ spending, income, subscriptionCount, annualCost, period }: Props) {
  const native = isNativeApp();
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-3 xl:grid-cols-4">
    {[['Money out', money(spending), period], ['Money in', money(income), period], ['Active subscriptions', String(subscriptionCount), 'Currently marked active'], ['Estimated annual cost', money(annualCost), 'Active subscriptions · not guaranteed savings']].map(([label, value, detail]) => (
      <Card key={label} role={native ? "group" : undefined} tabIndex={native ? 0 : undefined} aria-label={native ? `${label}: ${value}. ${detail}.` : undefined}><CardContent aria-hidden={native || undefined} className="break-words p-5"><h2 className="text-sm text-muted-foreground">{label}</h2><p className="my-2 break-words text-2xl font-semibold tabular-nums tracking-tight">{value}</p><p className="text-xs leading-relaxed text-muted-foreground">{detail}</p></CardContent></Card>
    ))}
  </div>;
}
