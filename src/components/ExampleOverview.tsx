import { useState } from 'react';
import { Button } from './ui/button';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { CategoryBars } from './StatementCharts';
import MerchantMark from './MerchantMark';
import { resolveMerchant } from '@/lib/merchant-identity';
import { money } from '@/lib/analytics';

// Read-only figures from the approved Figma example; never enter account queries.
const categories = [
  { name: 'Rent', value: 950 }, { name: 'Groceries', value: 213.42 },
  { name: 'Utilities', value: 113 }, { name: 'Other spending', value: 247.27 },
].sort((a, b) => b.value - a.value);

export default function ExampleOverview({ onImport }: { onImport: () => void }) {
  const [details, setDetails] = useState(false);
  return <DialogContent><DialogHeader><DialogTitle>Example overview</DialogTitle><DialogDescription>Invented example data. Your account stays empty until you import your own statement.</DialogDescription></DialogHeader>
    <div className="space-y-6">
      <section className="space-y-2"><p className="font-semibold">September 2026 · Example</p><p className="app-amount">{money(1523.69)}</p><p className="text-muted-foreground">Spent from an example statement</p><p>Income <span className="text-primary">{money(3200)}</span></p><p className="app-caption">Example transactions through 2 Sep · Partial month</p></section>
      <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="app-section-title">Where it went</h2><Button variant="link" onClick={() => setDetails(value => !value)}>{details ? 'Show less' : 'All categories'}</Button></div><CategoryBars data={categories} limit={details ? undefined : 3} /></section>
      <section><h2 className="app-section-title">Coming up</h2><p className="app-caption mt-2">Example estimates · 2 October</p><ul className="divide-y">{[['Netflix', 12.99], ['Spotify', 11.99]].map(([name, amount]) => <li key={name} className="merchant-row"><MerchantMark merchant={resolveMerchant(String(name))} category="Subscription" /><span className="merchant-row-label">{name}<span className="merchant-row-detail">Monthly · estimated</span></span><span className="merchant-row-amount">{money(Number(amount))}</span></li>)}</ul></section>
      <Button className="w-full" onClick={onImport}>Import my statement</Button>
    </div>
  </DialogContent>;
}
