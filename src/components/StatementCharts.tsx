import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { availableMonths, currentMonth, statementCoverage, money, monthLabel, summarizeTransactions, transactionTrend, type CategoryAmount, type StatementTransaction } from '@/lib/analytics';

export function CategoryBars({ data, limit, onSelect }: { data: CategoryAmount[]; limit?: number; onSelect?: (category: string) => void }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!total) return <p className="py-6 text-muted-foreground">No spending imported for this month.</p>;
  return <ul className="category-bars" aria-label="Money out by category">{data.slice(0, limit).map(item => {
    const share = item.value / total * 100;
    const content = <><span className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span className="min-w-0 break-words">{item.name}</span><span className="tabular-nums">{money(item.value)}{!limit && <span className="text-muted-foreground"> · {share.toFixed(1)}%</span>}</span></span><span className="category-track" aria-hidden="true"><span style={{ width: `${share}%` }} /></span></>;
    return <li key={item.name}>{onSelect ? <button type="button" className="w-full rounded text-left" onClick={() => onSelect(item.name)} aria-label={`${item.name}: ${money(item.value)}, ${share.toFixed(1)}% of spending. View transactions`}>{content}</button> : content}</li>;
  })}</ul>;
}

export function MonthPicker({ rows, month, onChange }: { rows: StatementTransaction[]; month: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="sr-only">Statement month</span><select aria-label="Statement month" className="month-picker" value={month} onChange={e => onChange(e.target.value)}>{[...new Set([currentMonth(), ...availableMonths(rows)])].sort().reverse().map(value => <option key={value} value={value}>{monthLabel(value)}</option>)}</select></label>;
}

export default function StatementCharts({ rows, month, onMonthChange }: { rows: StatementTransaction[]; month: string; onMonthChange: (month: string) => void }) {
  const [view, setView] = useState<'categories' | 'time'>('categories');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const summary = summarizeTransactions(rows.filter(row => row.date.startsWith(month)));
  const invalidRange = !!from && !!to && from > to;
  const trend = transactionTrend(rows).filter(point => (!from || point.key >= from) && (!to || point.key <= to));
  const max = Math.max(1, ...trend.map(point => point.spending));
  const scale = Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max)))) * Math.pow(10, Math.floor(Math.log10(max)));
  return <div className="space-y-6">
    <h1 className="app-title">Charts &amp; insights</h1>
    <div className="segmented-control" aria-label="Chart view">{(['categories', 'time'] as const).map(value => <Button key={value} variant={view === value ? 'default' : 'soft'} aria-pressed={view === value} onClick={() => setView(value)}>{value === 'categories' ? 'Categories' : 'Over time'}</Button>)}</div>
    {view === 'categories' ? <>
      <MonthPicker rows={rows} month={month} onChange={onMonthChange} />
      <div><p className="app-amount">{money(summary.spending)}</p><p className="app-caption mt-3">Money out · {statementCoverage(rows, month)}</p></div>
      <dl className="summary-pair"><div><dt>Money in</dt><dd className="text-primary">{money(summary.income)}</dd></div><div><dt>Income − spending</dt><dd>{money(summary.income - summary.spending)}</dd></div></dl>
      <section className="space-y-4"><h2 className="text-base text-muted-foreground">Money out by category</h2><CategoryBars data={summary.categories} /></section>
      <Button variant="soft" asChild className="w-full"><Link to="/dashboard/activity">View recorded activity</Link></Button>
    </> : <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[['From month', from, setFrom], ['To month', to, setTo]].map(([label, value, update]) => <label key={String(label)} className="app-caption">{String(label)}<select aria-label={String(label)} value={String(value)} onChange={e => (update as (value: string) => void)(e.target.value)} className="mt-2 w-full rounded-xl border bg-card px-3 py-3 text-base"><option value="">All months</option>{availableMonths(rows).map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>)}</div>
      {(from || to) && <Button variant="link" onClick={() => { setFrom(''); setTo(''); }}>Reset</Button>}
      <section className="space-y-5"><h2 className="app-section-title">Monthly spending</h2>
        {invalidRange ? <p role="alert">Choose an end month on or after the start month.</p> : !trend.length ? <p>No imported transactions in this period.</p> : <>
          <div className="monthly-chart" role="region" aria-label="Monthly spending chart, scroll for more months" tabIndex={0}>
            <div className="monthly-scale" aria-hidden="true"><span>{money(scale)}</span><span>{money(scale / 2)}</span><span>£0</span></div>
            <div className="monthly-columns">{trend.map(point => <button key={point.key} type="button" className="monthly-column" onClick={() => onMonthChange(point.key)} aria-label={`${point.month}: ${money(point.spending)} money out. ${statementCoverage(rows, point.key)}. Show figures`} aria-pressed={point.key === month}>
              <span className="monthly-bar-area"><span className="monthly-value">{money(point.spending)}</span><span className="monthly-bar" style={{ height: `${point.spending / scale * 100}%` }} /></span>
              <span>{new Date(`${point.key}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</span>
            </button>)}</div>
          </div>
          <p className="rounded-xl bg-card p-4 text-sm leading-relaxed">Months may be incomplete. These dates describe recorded transactions, not verified statement coverage. A lower bar does not necessarily mean spending has fallen.</p>
          <section className="space-y-3"><h3 className="app-section-title">{monthLabel(month)} figures</h3><p className="app-caption">{statementCoverage(rows, month)}</p><dl className="space-y-3">{[['Money out', summary.spending], ['Money in', summary.income], ['Income − spending', summary.income - summary.spending]].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2"><dt>{label}</dt><dd className="font-semibold tabular-nums">{money(Number(value))}</dd></div>)}</dl></section>
        </>}
      </section>
    </>}
    <p className="app-caption">Figures use imported GBP transactions only. Income minus spending is not your bank balance.</p>
  </div>;
}
