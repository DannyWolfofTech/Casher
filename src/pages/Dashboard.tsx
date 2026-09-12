import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronRight, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useStatementData } from '@/hooks/useStatementData';
import { money, statementCoverage } from '@/lib/analytics';
import { nextRenewal } from '@/lib/subscription-renewals';
import { resolveMerchant } from '@/lib/merchant-identity';
import AppShell, { NavigationIcon } from '@/components/AppShell';
import fileIcon from '@/assets/navigation/file.svg';
import { OnboardingModal } from '@/components/OnboardingModal';
import CSVUpload, { type UploadResult } from '@/components/CSVUpload';
import SubscriptionsList from '@/components/SubscriptionsList';
import SavingsGoals from '@/components/SavingsGoals';
import TransactionsTable from '@/components/TransactionsTable';
import StatementCharts, { CategoryBars, MonthPicker } from '@/components/StatementCharts';
import MerchantMark from '@/components/MerchantMark';
import SEO from '@/components/SEO';
import ExampleOverview from '@/components/ExampleOverview';

export default function Dashboard() {
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = pathname.split('/')[2] || 'overview';
  const [visited, setVisited] = useState<string[]>([tab]);
  useEffect(() => { setVisited(prev => prev.includes(tab) ? prev : [...prev, tab]); }, [tab]);
  const [showUpload, setShowUpload] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStarted, setUploadStarted] = useState(false);
  const [lastUpload, setLastUpload] = useState<UploadResult | null>(null);
  const client = useQueryClient();
  const auth = useAuth();
  const data = useDashboardData(auth.user?.id, 0);
  const statements = useStatementData(auth.user?.id);
  useEffect(() => {
    if (searchParams.get('import') === '1') { setShowUpload(true); setSearchParams({}, { replace: true }); }
  }, [searchParams, setSearchParams]);
  const refresh = () => {
    for (const key of ['transactions', 'subscriptions', 'upload-history']) void client.invalidateQueries({ queryKey: [key, auth.user?.id] });
  };
  const handleUploadComplete = (result?: UploadResult) => {
    if (result?.usage) { auth.setUploadsUsed(result.usage.uploadsUsed); auth.setCanUpload(result.usage.canUpload); }
    if (!result?.code || !['OK', 'REPLAY'].includes(result.code)) return;
    setLastUpload(result); setShowUpload(false); setUploadStarted(false); data.setSelectedMonth(null); refresh();
  };
  if (!['overview', 'activity', 'subscriptions', 'goals', 'insights', 'history'].includes(tab)) return <Navigate to="/dashboard" replace />;
  if (auth.loading || !auth.user) return <div role="status" className="min-h-screen flex items-center justify-center p-6">Loading your account…</div>;
  const rows = statements.transactions.data || [];
  const upcoming = (statements.subscriptions.data || []).filter(sub => sub.status === 'active').map(sub => ({ sub, due: nextRenewal(sub) })).filter(item => !!item.due).sort((a, b) => a.due!.localeCompare(b.due!)).slice(0, 3);
  const show = (name: string) => tab === name || visited.includes(name);
  const insights = tab === 'insights' || tab === 'history';
  return <AppShell onImport={() => { setLastUpload(null); setShowUpload(true); }} importing={uploading} back={insights ? '/dashboard' : undefined}>
    <SEO title={`${insights ? 'Charts & insights' : tab === 'overview' ? 'Overview' : tab[0].toUpperCase() + tab.slice(1)} — Casher`} description="Review your statement spending and recurring subscriptions." path={pathname} noindex />
    <OnboardingModal open={auth.showOnboarding} onClose={() => auth.setShowOnboarding(false)} />
    <Dialog open={showExample} onOpenChange={setShowExample}><ExampleOverview onImport={() => { setShowExample(false); setShowUpload(true); }} /></Dialog>
    {auth.accountError && <div role="alert" className="mb-6 space-y-3 rounded-xl border p-4 text-sm"><p>{auth.accountError}</p><Button variant="outline" disabled={auth.refreshingAccount} onClick={auth.refreshAccount}>{auth.refreshingAccount ? 'Checking account…' : 'Retry account check'}</Button></div>}
    <Dialog open={showUpload} onOpenChange={open => { if (!uploading) { setShowUpload(open); if (!open) setUploadStarted(false); } }}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Import statement</DialogTitle><DialogDescription>Choose a CSV from your bank. Review it before adding it to Casher.</DialogDescription></DialogHeader>
        {uploadStarted || (auth.allowanceReady && auth.canUpload) ? <CSVUpload quotaReached={auth.allowanceReady && !auth.canUpload} onUploadComplete={handleUploadComplete} onProcessingChange={busy => { setUploading(busy); if (busy) setUploadStarted(true); }} onImportSettled={() => { refresh(); auth.refreshUploadAllowance(); }} /> : !auth.allowanceReady ? <div role="status" className="space-y-3"><p>{auth.accountError || 'Checking upload allowance…'}</p>{auth.accountError && <Button onClick={auth.refreshAccount} disabled={auth.refreshingAccount}>Retry account check</Button>}</div> : <p role="status">Upload limit reached · {auth.uploadsUsed} used this month.</p>}
      </DialogContent>
    </Dialog>
    {lastUpload && <div role="status" className="mb-6 space-y-3 rounded-xl bg-card p-4"><h2 className="font-semibold">{lastUpload.replay ? 'This statement was already imported.' : 'Import complete'}</h2><p>{lastUpload.transactionsCount || 0} transactions imported.{!!lastUpload.duplicatesSkipped && ` ${lastUpload.duplicatesSkipped} duplicates skipped.`}</p>{!!lastUpload.skippedRows && <p>{lastUpload.skippedRows} rows could not be read. Review your statement before relying on these totals.</p>}<Button variant="link" asChild><Link to="/dashboard/activity" onClick={() => setLastUpload(null)}>Review imported activity</Link></Button></div>}
    {(tab === 'overview' || insights) && (data.error ? <div role="alert" className="space-y-4 rounded-xl border p-6"><h1 className="app-title">{insights ? 'Charts & insights' : 'Overview'}</h1><h2 className="font-semibold">Your overview could not be loaded</h2><p>We could not retrieve all the data needed to calculate reliable totals.</p><Button variant="outline" onClick={data.retry}>Try again</Button></div> : data.loading ? <p role="status" className="py-12">Loading your statement totals…</p> : <>
      {data.legacyTransactionsCount > 0 && <p role="note" className="mb-6 rounded-xl border border-amber-600/40 bg-amber-500/5 p-4 text-sm">{data.legacyTransactionsCount} older transactions in this month have no recorded payment direction. These totals use estimated classifications. Compare them with your original statement before relying on them.</p>}
      {insights ? <StatementCharts rows={rows} month={data.month} onMonthChange={data.setSelectedMonth} /> : !data.hasTransactions ? <section className="mx-auto max-w-lg space-y-6"><h1 className="app-title">Your money, made clearer.</h1><p className="text-[1.0625rem] text-muted-foreground">Start with a bank statement. See where it went and spot repeating payments.</p><div className="space-y-4 rounded-2xl bg-card p-4"><span className="text-primary"><NavigationIcon source={fileIcon} /></span><h2 className="app-section-title">One CSV to get started</h2><p className="text-[1.0625rem] text-muted-foreground">Export a GBP statement from your bank, then choose it from Files or Downloads.</p></div><Button onClick={() => setShowUpload(true)} className="w-full">Import a statement</Button><Button variant="link" className="w-full" onClick={() => setShowExample(true)}>Explore an example</Button><p className="app-caption">GBP statements from one bank account · Up to 5 MB. You stay in control of your data.</p></section> : <div className="overview-layout space-y-8 md:space-y-0">
        <section className="space-y-6"><h1 className="sr-only">Overview</h1>
          <div className="space-y-2"><MonthPicker rows={rows} month={data.month} onChange={data.setSelectedMonth} /><p className="app-amount">{money(data.spending)}</p><p className="text-[.9375rem] text-muted-foreground">Spent from your statements</p><p className="text-[.9375rem] text-muted-foreground">Income <span className="ml-1 text-primary">{money(data.income)}</span></p><p className="app-caption">{statementCoverage(rows, data.month)}</p></div>
          <Button variant="soft" className="w-full" asChild><Link to="/dashboard/insights"><BarChart3 aria-hidden="true" />Charts &amp; insights</Link></Button>
          {data.hasTransactions && <section className="space-y-4"><div className="flex items-center justify-between gap-3"><h2 className="app-section-title">Where it went</h2><Button variant="link" asChild className="px-0"><Link to="/dashboard/insights">Details</Link></Button></div><CategoryBars data={data.categories} limit={3} /></section>}
        </section>
        <section className="space-y-3"><div className="flex items-center justify-between gap-3"><h2 className="app-section-title">Coming up</h2><Button variant="link" asChild className="px-0"><Link to="/dashboard/subscriptions">View all</Link></Button></div>
          {upcoming.length ? <ul className="divide-y">{upcoming.map(({sub,due}) => <li key={sub.id}><Link className="merchant-row" to={`/dashboard/subscriptions?renewal=${encodeURIComponent(sub.id)}`}><MerchantMark merchant={resolveMerchant(sub.service_name)} category="Subscription" /><span className="merchant-row-label">{resolveMerchant(sub.service_name)?.name || sub.service_name}<span className="merchant-row-detail">{new Date(`${due}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} · {sub.frequency} estimate</span></span><span className="merchant-row-amount">{money(Number(sub.amount))}</span><ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link></li>)}</ul> : <p className="py-5 text-sm text-muted-foreground">No renewals can be estimated yet. Import a statement to look for recurring payments.</p>}
          <p className="app-caption">Expected dates come from past payments. Casher does not schedule charges. Older statements cannot confirm whether a subscription is still running.</p>
          <p className="app-caption border-t pt-4">Analysis uses the GBP statements you import. No bank connection is required. Totals are not your bank balance.</p>
        </section>
      </div>}
    </>)}
    {show('activity') && <section hidden={tab !== 'activity'} className="space-y-6"><div className="space-y-4"><h1 className="app-title">Activity</h1><p className="text-[.9375rem] text-muted-foreground">Recorded money in and out</p></div><TransactionsTable onMonthChange={data.setSelectedMonth} refreshKey={0} userTier={auth.userTier} userId={auth.user.id} month={data.month} onDataChanged={refresh} /></section>}
    {show('subscriptions') && <section hidden={tab !== 'subscriptions'}><SubscriptionsList userId={auth.user.id} onDataChanged={refresh} /></section>}
    {show('goals') && <section hidden={tab !== 'goals'} className="space-y-6"><h1 className="app-title">Goals</h1><SavingsGoals userId={auth.user.id} /></section>}
  </AppShell>;
}
