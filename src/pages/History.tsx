import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useStatementData } from '@/hooks/useStatementData';
import { annualSubscriptionCost, money, transactionTrend } from '@/lib/analytics';
import DashboardHeader from '@/components/DashboardHeader';
import CategoryChart from '@/components/CategoryChart';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SEO from '@/components/SEO';

export default function History() {
  const auth = useAuth();
  const { transactions, subscriptions } = useStatementData(auth.user?.id);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const invalidRange = !!from && !!to && from > to;
  const trend = useMemo(() => transactionTrend(transactions.data || []).filter(point => (!from || point.key >= from) && (!to || point.key <= to)), [transactions.data, from, to]);
  const active = (subscriptions.data || []).filter(sub => sub.status === 'active');
  const cancelled = (subscriptions.data || []).filter(sub => sub.status === 'cancelled');
  const categories = new Map<string, number>();
  for (const sub of active) {
    const lower = sub.service_name.toLowerCase();
    const category = /netflix|spotify|prime|disney/.test(lower) ? 'Streaming' : /gym|fitness/.test(lower) ? 'Fitness' : /adobe|microsoft|cloud/.test(lower) ? 'Software' : 'Other';
    categories.set(category, (categories.get(category) || 0) + annualSubscriptionCost(sub));
  }
  if (auth.loading || !auth.user) return <div role="status" className="p-8">Loading your account…</div>;
  return <div className="min-h-screen">
    <SEO title="Spending history — Casher" description="Spending by transaction month and your subscription records." path="/dashboard/history" noindex />
    <DashboardHeader isAdmin={auth.isAdmin} userTier={auth.userTier} hasUser onSignOut={auth.handleSignOut} />
    <main id="main-content" className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div><Link className="text-sm underline underline-offset-4" to="/dashboard">Back to overview</Link><h1 className="mt-4 text-3xl font-semibold tracking-tight">Spending history</h1><p className="mt-2 text-sm text-muted-foreground">Understand the statements you have imported over time.</p></div>
      {auth.accountError && <div role="alert" className="space-y-3 rounded-lg border p-4 text-sm"><p>{auth.accountError}</p><Button variant="outline" disabled={auth.refreshingAccount} onClick={auth.refreshAccount}>Retry account check</Button></div>}
      {transactions.data?.some(row => !row.direction) && <p role="note" className="rounded-lg border border-amber-600/40 bg-amber-500/5 p-4 text-sm">Your history includes older transactions without a recorded payment direction. Their classifications are estimates; compare the totals with your original statements.</p>}
      {transactions.isError || subscriptions.isError ? <Card><CardContent role="alert" className="space-y-3 p-6"><p>Your history could not be loaded. Totals are unavailable.</p><Button variant="outline" onClick={() => { void transactions.refetch(); void subscriptions.refetch(); }}>Try again</Button></CardContent></Card>
      : transactions.isPending || subscriptions.isPending ? <p role="status">Loading history…</p> : <>
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <Card className="min-w-0"><CardHeader><CardTitle>Monthly spending</CardTitle><CardDescription>Money out by transaction date, excluding money in. Only imported months are shown.</CardDescription></CardHeader><CardContent>
            <div className="mb-6 flex flex-wrap items-end gap-3">
              <label className="min-w-0 flex-1 text-xs">From month<input type="month" aria-label="From month" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 block h-10 w-full rounded-md border bg-background px-2 text-sm" /></label>
              <label className="min-w-0 flex-1 text-xs">To month<input type="month" aria-label="To month" value={to} onChange={e => setTo(e.target.value)} className="mt-1 block h-10 w-full rounded-md border bg-background px-2 text-sm" /></label>
              {(from || to) && <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo(''); }}>Reset</Button>}
            </div>
            {invalidRange ? <p role="alert">Choose an end month on or after the start month.</p> : trend.length === 0 ? <p className="py-12 text-sm text-muted-foreground">No imported transactions in this period.</p> : <>
              <div className="h-64 w-full min-w-0" aria-hidden="true"><ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={trend} margin={{ left: 0, right: 8, bottom: 8 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="key" tickFormatter={key => key.slice(2)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} /><YAxis width={65} tickFormatter={value => `£${Number(value).toLocaleString('en-GB')}`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} /><Tooltip labelFormatter={key => trend.find(point => point.key === key)?.month || key} formatter={(value: number) => [money(value), 'Money out']} contentStyle={{ background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', borderColor: 'hsl(var(--border))' }} /><Bar dataKey="spending" fill="#327a61" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false} />
              </BarChart></ResponsiveContainer></div>
              <table className="mt-4 w-full text-sm"><caption className="sr-only">Imported spending by transaction month</caption><thead><tr className="border-b"><th className="py-2 text-left font-medium">Month</th><th className="text-right font-medium">Money out</th><th className="text-right font-medium">Money in</th></tr></thead><tbody>{trend.map(point => <tr key={point.key} className="border-b last:border-0"><th scope="row" className="py-3 text-left font-normal">{point.month}</th><td className="text-right tabular-nums">{money(point.spending)}</td><td className="text-right tabular-nums">{money(point.income)}</td></tr>)}</tbody></table>
              <p className="mt-4 text-xs text-muted-foreground">Months may be incomplete. A lower imported total does not necessarily mean you saved money.</p>
            </>}
          </CardContent></Card>
          <Card className="min-w-0"><CardHeader><CardTitle>Active subscription costs</CardTitle><CardDescription>Estimated annual cost on the same basis for every billing frequency. Independent of the spending date filter.</CardDescription></CardHeader><CardContent><CategoryChart data={[...categories].map(([name, value]) => ({ name, value }))} label="Estimated annual cost of active subscriptions" /></CardContent></Card>
        </div>
        <Card><CardHeader><CardTitle>Marked as cancelled</CardTitle><CardDescription>Records you have marked as cancelled. These estimates do not confirm refunds or realised savings.</CardDescription></CardHeader><CardContent>
          {cancelled.length === 0 ? <p className="text-sm text-muted-foreground">No subscriptions marked as cancelled. Review subscriptions from your overview.</p> : <ul className="divide-y">{cancelled.map(sub => <li key={sub.id} className="flex flex-wrap justify-between gap-3 py-3"><span className="min-w-0 break-words">{sub.service_name}</span><span className="text-sm text-muted-foreground">{money(annualSubscriptionCost(sub))} estimated annual cost avoided</span></li>)}</ul>}
        </CardContent></Card>
      </>}
    </main>
  </div>;
}
