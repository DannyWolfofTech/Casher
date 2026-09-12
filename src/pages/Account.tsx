import { readRequest } from '@/lib/read-request';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SEO from '@/components/SEO';
import { saveFile } from '@/lib/save-file';
import { readAllPages } from '@/lib/pagination';
import AppShell from '@/components/AppShell';
import UploadHistory from '@/components/UploadHistory';
import { useTheme } from '@/contexts/theme-context';
import { LanguageSelector } from '@/components/LanguageSelector';
import { FileText, Palette, Languages, CircleHelp, ShieldCheck, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ClearStatementData from '@/components/ClearStatementData';

export default function Account() {
  const dataPage = useLocation().pathname === '/account/data';
  const { theme, toggleTheme } = useTheme();
  const [showDelete, setShowDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [clearing, setClearing] = useState(false);
  // Deletion owns its signed-out destination, including the confirmation.
  // The normal auth guard must not race it back to the plain sign-in page.
  const { user, loading, handleSignOut } = useAuth(!busy && !deleted);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const navigate = useNavigate();
  const cache = useQueryClient();
  const exportData = async () => {
    if (!user || exporting || busy || clearing) return;
    setExporting(true); setExportError('');
    try {
      const tables = ['profiles','transactions','detected_subscriptions','savings_goals','upload_history','statement_reviews'] as const;
      const data = Object.fromEntries(await Promise.all(tables.map(async table => [table,
        await readRequest(signal => readAllPages((from,to) => supabase.from(table).select('*').eq('user_id',user.id).order('id').range(from,to).abortSignal(signal).retry(false))),
      ])));
      await saveFile(JSON.stringify({ exported_at: new Date().toISOString(), account: {id:user.id,email:user.email,created_at:user.created_at}, ...data },null,2),
        `casher-account-${new Date().toISOString().slice(0,10)}.json`,'application/json');
    } catch { setExportError('Your data could not be exported. Check your connection and try again.'); }
    finally { setExporting(false); }
  };
  const remove = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.email || confirmation !== 'DELETE' || busy || clearing) return;
    setBusy(true); setError('');
    try {
      if (password) {
        const result = await supabase.auth.signInWithPassword({ email: user.email, password });
        setPassword('');
        if (result.error || result.data.user?.id !== user.id) throw new Error('Your password could not be verified. Try again.');
      }
      const result = await supabase.functions.invoke('delete-account', { body: { confirmation } });
      if (result.error) {
        const response = (result.error as {context?:Response}).context;
        const body = await response?.clone().json().catch(()=>null);
        throw new Error(body?.error || 'Deletion could not finish. Please try again.');
      }
      if (result.data?.deleted !== true) throw new Error('Deletion was not confirmed. Please try again.');
      setDeleted(true);
      cache.clear();
      await supabase.auth.signOut({scope:'local'});
      navigate('/auth?deleted=1',{replace:true});
    } catch(e) { setError(e instanceof Error ? e.message : 'Deletion could not finish. Please try again.'); }
    finally { setBusy(false); setPassword(''); }
  };
  if (loading || !user) return <div role="status" className="p-8">Loading your account…</div>;
  return <AppShell back={dataPage ? "/account" : "/dashboard"}>
    <SEO title="Account — Casher" description="Manage your Casher account and personal data." path="/account" noindex />
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="app-title">{dataPage ? 'Statements & data' : 'Account'}</h1>
      {!dataPage && <>
        <div className="space-y-2"><p className="app-section-title break-words">{user.user_metadata?.full_name || 'Your account'}</p><p className="break-all text-[.9375rem] text-muted-foreground">{user.email}</p></div>
        <div className="divide-y">
          <Link to="/account/data" className="merchant-row"><FileText aria-hidden="true" className="h-7 w-7 shrink-0" /><span className="merchant-row-label">Statements &amp; data<span className="merchant-row-detail">Imports, export and reset</span></span><ChevronRight aria-hidden="true" className="h-4 w-4" /></Link>
          <button type="button" className="merchant-row" onClick={toggleTheme} aria-label={`Appearance: ${theme === 'light' ? 'Original light' : 'Dark'}. Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}><Palette aria-hidden="true" className="h-7 w-7 shrink-0" /><span className="merchant-row-label">Appearance<span className="merchant-row-detail">{theme === 'light' ? 'Original light' : 'Dark'}</span></span><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
          <div className="merchant-row"><Languages aria-hidden="true" className="h-7 w-7 shrink-0" /><span className="merchant-row-label">Language<span className="merchant-row-detail">Display preferences</span></span><LanguageSelector /></div>
          <Link to="/support" className="merchant-row"><CircleHelp aria-hidden="true" className="h-7 w-7 shrink-0" /><span className="merchant-row-label">Help &amp; support<span className="merchant-row-detail">Statement and app help</span></span><ChevronRight aria-hidden="true" className="h-4 w-4" /></Link>
          <div className="merchant-row"><ShieldCheck aria-hidden="true" className="h-7 w-7 shrink-0" /><div className="merchant-row-label"><Link to="/privacy" className="inline-flex min-h-11 items-center">Privacy Policy</Link><span className="merchant-row-detail"><Link to="/terms" className="inline-flex min-h-11 items-center underline">Terms of Service</Link></span></div></div>
        </div>
        <Button variant="soft" className="w-full" onClick={handleSignOut} disabled={busy || clearing || exporting}>Sign out</Button>
        <Button variant="link" className="w-full text-destructive" onClick={() => { setConfirmation(''); setPassword(''); setError(''); setShowDelete(true); }}>Delete account</Button>
      </>}
      {dataPage && <>
      <Button asChild className="w-full"><Link to="/dashboard?import=1">Import a statement</Link></Button>
      <UploadHistory userId={user.id} />
      <section className="space-y-3"><h2 className="text-xl font-semibold">Your data</h2><p className="text-sm text-muted-foreground">Download your profile, imported transactions, corrections, detected subscriptions, goals and upload history as a JSON file. This is available on every plan. Contact privacy@trycasher.com for other personal-data requests.</p><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={exportData} disabled={exporting || busy || clearing}>{exporting ? 'Preparing your data…' : 'Export my saved data'}</Button><Button asChild variant="ghost"><Link to="/dashboard/activity" aria-label="Open transaction history"><span aria-hidden="true">Open transaction history</span></Link></Button></div>{exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}<nav aria-label="Account policies" className="flex flex-wrap gap-x-5 text-sm"><Link to="/support" className="inline-flex min-h-11 items-center underline">Help and support</Link><Link to="/privacy" className="inline-flex min-h-11 items-center underline" aria-label="Privacy Policy"><span aria-hidden="true">Privacy Policy</span></Link><Link to="/terms" className="inline-flex min-h-11 items-center underline" aria-label="Terms of Service"><span aria-hidden="true">Terms of Service</span></Link></nav></section>
      <ClearStatementData disabled={exporting || busy} onBusyChange={setClearing} />
      </>}
      <Dialog open={showDelete} onOpenChange={open => { if (!busy) { setShowDelete(open); if (!open) setPassword(''); } }}><DialogContent><DialogHeader><DialogTitle>Delete your account</DialogTitle><DialogDescription>Permanently remove your Casher account and its saved data.</DialogDescription></DialogHeader><section className="space-y-4">
        <p className="text-sm leading-6">This permanently removes your Casher sign-in, imported transactions, corrections, detected subscriptions, goals and upload history. Any active Casher subscription is cancelled immediately, and remaining access ends. This does not cancel services listed in your statements. Billing records required by Stripe or law may be retained. Any refund request is handled separately.</p>
        <p className="text-sm text-muted-foreground">Sign in within the last 10 minutes to confirm deletion. If you use email and password, you can verify your password below. If you use Google, sign out and sign in again, then return here.</p>
        <form onSubmit={remove} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="delete-password">Current password (if you need to sign in again)</Label><Input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy} /></div>
          <div className="space-y-2"><Label htmlFor="delete-confirmation">Type DELETE to confirm</Label><Input id="delete-confirmation" autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="destructive" disabled={confirmation !== 'DELETE' || busy || exporting || clearing}>{busy ? 'Deleting account…' : 'Delete account and cancel Casher'}</Button>
        </form>
      </section></DialogContent></Dialog>
    </div>
  </AppShell>;
}
