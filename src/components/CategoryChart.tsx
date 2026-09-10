import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { money, type CategoryAmount } from '@/lib/analytics';

const palette = ['#327a61', '#416ba9', '#9c651c', '#8b5a96', '#b65b54', '#41838b', '#697443', '#84644e', '#6b7280'];
const known = ['Rent', 'Groceries', 'Subscription', 'Transport', 'Dining', 'Fitness', 'Utilities', 'Shopping', 'Other'];
function color(name: string) { const index = known.indexOf(name); return palette[index >= 0 ? index : [...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % palette.length]; }

export default function CategoryChart({ data, label }: { data: CategoryAmount[]; label: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const valid = data.filter(row => Number.isFinite(row.value) && row.value > 0).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const total = valid.reduce((sum, row) => sum + row.value, 0);
  const active = valid.find(row => row.name === selected);
  if (total === 0) return <p className="py-12 text-center text-sm text-muted-foreground">No spending recorded for this period.</p>;
  return (
    <figure aria-label={label} className="min-w-0 space-y-4">
      <div className="relative mx-auto h-[228px] w-full max-w-[320px] [&_*]:outline-none [-webkit-tap-highlight-color:transparent]" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart accessibilityLayer={false}>
            <Pie rootTabIndex={-1} onClick={row => setSelected(previous => previous === row.name ? null : row.name)} data={valid} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={76} outerRadius={104} startAngle={90} endAngle={-270} stroke="hsl(var(--card))" strokeWidth={1} isAnimationActive={false} label={false} labelLine={false}>
              {valid.map(row => <Cell key={row.name} fill={color(row.name)} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="max-w-32 text-center text-xs text-muted-foreground">{active?.name || 'Total'}</span>
          <span className="text-xl font-semibold tabular-nums">{money(active?.value ?? total)}</span>
        </div>
      </div>
      <figcaption className="sr-only" aria-live="polite">{active ? `${active.name}: ${money(active.value)}. ` : ''}{label}. Total {money(total)}. Values listed below.</figcaption>
      <ul className="divide-y" aria-label="Category amounts">
        {valid.map(row => <li key={row.name} className="flex items-center gap-3 py-2 text-sm">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color(row.name) }} />
          <button type="button" aria-pressed={active?.name === row.name} onClick={() => setSelected(previous => previous === row.name ? null : row.name)} className="min-w-0 flex-1 rounded py-2 text-left break-words focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{row.name}</button>
          <span className="shrink-0 tabular-nums font-medium">{money(row.value)}</span>
          <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">{(row.value / total * 100).toFixed(1)}%</span>
        </li>)}
      </ul>
    </figure>
  );
}
