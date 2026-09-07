import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SEO from '@/components/SEO';
import { saveFile } from '@/lib/save-file';
import { readAllPages } from '@/lib/pagination';

export default function Account() {
  const { user, loading } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const navigate = useNavigate();
  const cache = useQueryClient();
  const exportData = async () => {
    if (!user || exporting || busy) return;
    setExporting(true); setExportError('');
    try {
      const tables = ['profiles','transactions','detected_subscriptions','savings_goals','upload_history','statement_reviews'] as const;
      const data = Object.fromEntries(await Promise.all(tables.map(async table => [table,
        await readAllPages((from,to) => supabase.from(table).select('*').eq('user_id',user.id).order('id').range(from,to)),
      ])));
      await saveFile(JSON.stringify({ exported_at: new Date().toISOString(), account: {id:user.id,email:user.email,created_at:user.created_at}, ...data },null,2),
        `casher-account-${new Date().toISOString().slice(0,10)}.json`,'application/json');
    } catch { setExportError('Your data could not be exported. Check your connection and try again.'); }
    finally { setExporting(false); }
  };
  const remove = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.email || confirmation !== 'DELETE' || busy) return;
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
      cache.clear();
      await supabase.auth.signOut({scope:'local'});
      navigate('/auth?deleted=1',{replace:true});
    } catch(e) { setError(e instanceof Error ? e.message : 'Deletion could not finish. Please try again.'); }
    finally { setBusy(false); setPassword(''); }
  };
  if (loading || !user) return <div role="status" className="p-8">Loading your account…</div>;
  return <div className="min-h-screen bg-background">
    <SEO title="Account — Casher" description="Manage your Casher account and personal data." path="/account" noindex />
    <header className="border-b px-4 py-4"><Button asChild variant="ghost"><Link to="/dashboard">Back to dashboard</Link></Button></header>
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <h1 className="text-3xl font-semibold">Account</h1>
      <p className="break-all text-sm text-muted-foreground">Signed in as {user.email}</p>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Your data</h2><p className="text-sm text-muted-foreground">Download your profile, imported transactions, corrections, detected subscriptions, goals and upload history as a JSON file. This is available on every plan. Contact privacy@trycasher.com for other personal-data requests.</p><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={exportData} disabled={exporting || busy}>{exporting ? 'Preparing your data…' : 'Export my saved data'}</Button><Button asChild variant="ghost"><Link to="/dashboard/history">Open transaction history</Link></Button></div>{exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}<p className="text-sm"><Link to="/privacy" className="underline">Privacy Policy</Link> · <Link to="/terms" className="underline">Terms of Service</Link></p></section>
      <section className="space-y-4 border-t pt-6"><h2 className="text-xl font-semibold">Delete your account</h2>
        <p className="text-sm leading-6">This permanently removes your Casher sign-in, imported transactions, corrections, detected subscriptions, goals and upload history. Any active Casher subscription is cancelled immediately, and remaining access ends. This does not cancel services listed in your statements. Billing records required by Stripe or law may be retained. Any refund request is handled separately.</p>
        <p className="text-sm text-muted-foreground">Sign in within the last 10 minutes to confirm deletion. If you use email and password, you can verify your password below. If you use Google, sign out and sign in again, then return here.</p>
        <form onSubmit={remove} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="delete-password">Current password (if you need to sign in again)</Label><Input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy} /></div>
          <div className="space-y-2"><Label htmlFor="delete-confirmation">Type DELETE to confirm</Label><Input id="delete-confirmation" autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="destructive" disabled={confirmation !== 'DELETE' || busy || exporting}>{busy ? 'Deleting account…' : 'Delete account and cancel Casher'}</Button>
        </form>
      </section>
    </main>
  </div>;
}
