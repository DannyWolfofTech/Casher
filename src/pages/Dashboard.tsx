import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardData } from '@/hooks/useDashboardData';
import { currentMonth, monthLabel } from '@/lib/analytics';
import DashboardHeader from '@/components/DashboardHeader';
import DashboardSummaryCards from '@/components/DashboardSummaryCards';
import { OnboardingModal } from '@/components/OnboardingModal';
import CSVUpload, { type UploadResult } from '@/components/CSVUpload';
import SpendingChart from '@/components/SpendingChart';
import SubscriptionsList from '@/components/SubscriptionsList';
import SavingsGoals from '@/components/SavingsGoals';
import TransactionsTable from '@/components/TransactionsTable';
import UploadHistory from '@/components/UploadHistory';
import SEO from '@/components/SEO';

export default function Dashboard() {
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpload, setLastUpload] = useState<UploadResult | null>(null);
  const { t } = useTranslation();
  const { user, loading, isAdmin, userTier, uploadsUsed, canUpload, accountError, refreshingAccount, refreshAccount, showOnboarding, setShowOnboarding, setUploadsUsed, setCanUpload, handleSignOut } = useAuth();
  const data = useDashboardData(user?.id, refreshKey);
  const refresh = () => setRefreshKey(key => key + 1);
  const handleUploadComplete = (result?: UploadResult) => {
    if (result?.usage) { setUploadsUsed(result.usage.uploadsUsed); setCanUpload(result.usage.canUpload); }
    if (result?.code && result.code !== 'OK' && result.code !== 'REPLAY') return;
    setLastUpload(result || null); setShowUpload(false); data.setSelectedMonth(null); refresh();
  };
  if (loading || !user) return <div role="status" className="min-h-screen flex items-center justify-center gap-2"><Loader2 className="h-6 w-6 animate-spin" />Loading your account…</div>;
  const period = monthLabel(data.month);
  return <div className="min-h-screen bg-background">
    <SEO title="Dashboard — Casher" description="Review your statement spending and recurring subscriptions." path="/dashboard" noindex />
    <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    <DashboardHeader isAdmin={isAdmin} userTier={userTier} hasUser onSignOut={handleSignOut} />
    <main id="main-content" className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-1 text-sm text-muted-foreground">Your statements, made clearer</p><h1 className="text-3xl font-semibold tracking-tight">Overview</h1></div>
        <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
          <label className="min-w-0 flex-1 text-xs text-muted-foreground sm:flex-none">Statement month
            <select aria-label="Statement month" value={data.month} onChange={event => data.setSelectedMonth(event.target.value)} className="mt-1 block h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground sm:w-44">
              {[...new Set([currentMonth(), ...data.months])].sort().reverse().map(month => <option key={month} value={month}>{monthLabel(month)}</option>)}
            </select>
          </label>
          <Button onClick={() => setShowUpload(value => !value)} variant={showUpload ? 'outline' : 'default'}><Upload className="mr-2 h-4 w-4" />{showUpload ? 'Close upload' : 'Upload statement'}</Button>
        </div>
      </div>
      {accountError && <div role="alert" className="space-y-3 rounded-lg border p-4 text-sm"><p>{accountError}</p><Button variant="outline" disabled={refreshingAccount} onClick={refreshAccount}>{refreshingAccount ? 'Checking account…' : 'Retry account check'}</Button></div>}
      {showUpload && (canUpload ? <CSVUpload onUploadComplete={handleUploadComplete} /> : !accountError && <Card><CardContent className="space-y-3 p-5"><p>{t('uploadLimitReached')} · {uploadsUsed} used this month.</p><Button asChild><Link to="/pricing">View plans</Link></Button></CardContent></Card>)}
      {lastUpload && <div role="status" className="rounded-lg border bg-muted/40 p-4 text-sm">{lastUpload.replay ? 'This statement was already imported.' : `${lastUpload.transactionsCount || 0} transactions imported.`}{!!lastUpload.skippedRows && <p className="mt-1">{lastUpload.skippedRows} rows could not be read. Review your statement before relying on these totals.</p>}</div>}
      {data.error ? <Card><CardContent role="alert" className="space-y-3 p-6"><h2 className="font-semibold">Your overview could not be loaded</h2><p className="text-sm text-muted-foreground">We could not retrieve all the data needed to calculate reliable totals.</p><Button variant="outline" onClick={data.retry}>Try again</Button></CardContent></Card>
        : data.loading ? <div role="status" className="rounded-lg border p-8 text-sm text-muted-foreground">Loading your statement totals…</div>
        : <>
          <DashboardSummaryCards spending={data.spending} income={data.income} subscriptionCount={data.subscriptionCount} annualCost={data.annualCost} period={period} />
          {data.legacyTransactionsCount > 0 && <p role="note" className="rounded-lg border border-amber-600/40 bg-amber-500/5 p-4 text-sm">{data.legacyTransactionsCount} older transactions in this month have no recorded payment direction. These totals use estimated classifications. Compare them with your original statement before relying on them.</p>}
          <p className="text-xs leading-relaxed text-muted-foreground">Totals cover imported transactions only, in GBP. They are not your bank balance.{data.month !== currentMonth() && ' Showing your most recent statement month unless you select another.'}</p>
          {!data.hasTransactions && !showUpload && <Card><CardHeader><CardTitle>Start with your first statement</CardTitle><CardDescription>Export a CSV from your bank, then upload it to see spending and possible recurring payments.</CardDescription></CardHeader><CardContent><Button onClick={() => setShowUpload(true)}>Upload a CSV</Button><p className="mt-3 text-sm text-muted-foreground">Up to 5 MB · date, description and amount columns · no bank login required</p></CardContent></Card>}
          <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2"><SpendingChart data={data.categories} period={period} /><SubscriptionsList refreshKey={refreshKey} userId={user.id} onDataChanged={refresh} /></div>
        </>}
      <TransactionsTable refreshKey={refreshKey} userTier={userTier} userId={user.id} month={data.month} onDataChanged={refresh} />
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2"><UploadHistory userId={user.id} refreshKey={refreshKey} /><SavingsGoals userId={user.id} /></div>
      <p className="border-t pt-4 text-xs text-muted-foreground">Bank connections: {t("bankConnectInDevelopment")}. CSV uploads are available today.</p>
    </main>
  </div>;
}
