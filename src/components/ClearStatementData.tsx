import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { useAuth } from '@/hooks/useAuth';

export default function ClearStatementData({ disabled, onBusyChange }: { disabled: boolean; onBusyChange: (busy: boolean) => void }) {
  const { user, refreshUploadAllowance } = useAuth(false);
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const identity = useRef(user?.id);
  identity.current = user?.id;
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const clear = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.email || confirmation !== 'CLEAR' || busy || disabled) return;
    const owner = user.id;
    const current = () => active.current && identity.current === owner;
    const receiptKey = `casher:statement-reset:${owner}`;
    setBusy(true); onBusyChange(true); setError(''); setMessage('');
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (password) {
        const signed = await Promise.race([
          supabase.auth.signInWithPassword({ email: user.email, password }),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Password verification timed out. Check your connection and try again.')), 20_000); }),
        ]);
        clearTimeout(timer);
        if (!current()) return;
        setPassword('');
        if (signed.error || signed.data.user?.id !== owner) throw new Error('Your password could not be verified. Try again.');
      }
      if (!current()) return;
      // Save the retry ID before sending a destructive write, including across
      // navigation/relaunch. Never replace it after an unconfirmed response.
      let requestId: string;
      try {
        requestId = localStorage.getItem(receiptKey) || crypto.randomUUID();
        localStorage.setItem(receiptKey, requestId);
      } catch { throw new Error('This device cannot save reset progress. Enable app storage before clearing your data.'); }
      const result = await Promise.race([
        supabase.rpc('clear_statement_data', { _confirmation: confirmation, _request_id: requestId }).abortSignal(controller.signal).retry(false),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new Error('We could not confirm the reset. Retry here to check the same request before importing another file.')); controller.abort(); }, 30_000); }),
      ]);
      if (!current()) return;
      if (result.error) throw new Error(result.error.message || 'We could not confirm the reset. Retry here to check the same request.');
      if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data) || result.data.cleared !== true) throw new Error('The reset was not confirmed. Retry here to check the same request.');
      try { localStorage.removeItem(receiptKey); } catch { /* A retained receipt is safe to replay. */ }
      for (const key of ['transactions', 'subscriptions', 'upload-history']) cache.removeQueries({ queryKey: [key, owner] });
      refreshUploadAllowance();
      setOpen(false); setConfirmation('');
      setMessage('Your imported statement data has been cleared. Your account and savings goals are still available.');
    } catch (problem) { if (current()) setError(problem instanceof Error ? problem.message : 'We could not confirm the reset. Retry here to check the same request.'); }
    finally { clearTimeout(timer); if (current()) { setPassword(''); setBusy(false); onBusyChange(false); } }
  };
  return <section className="space-y-3 border-t pt-6">
    <h2 className="text-xl font-semibold">Clear imported statements</h2>
    <p className="text-sm leading-6">Remove all imported transactions, detected subscriptions, corrections and import history. Keep your account, savings goals and Casher plan. Monthly upload usage stays the same.</p>
    <p className="text-sm text-muted-foreground">Export your saved data above if you want a copy. This cannot be undone inside Casher.</p>
    <Button variant="outline" disabled={disabled || busy} onClick={() => { setOpen(true); setError(''); }}>Clear statement data</Button>
    {message && <p role="status" className="rounded-lg bg-muted p-3 text-sm">{message}</p>}
    <Dialog open={open} onOpenChange={next => { if (!busy) { setOpen(next); setPassword(''); } }}>
      <DialogContent onInteractOutside={event => event.preventDefault()}><DialogHeader><DialogTitle>Clear imported statement data?</DialogTitle><DialogDescription>All imported records and their corrections will be permanently removed. Your login, savings goals, plan and monthly upload usage remain. This does not cancel any subscription or service.</DialogDescription></DialogHeader>
        <p className="text-sm text-muted-foreground">If you have used this month's allowance, clearing data will not grant another upload. Finish uploads on other devices before continuing.</p>
        <p className="text-sm text-muted-foreground">Sign in within the last 10 minutes, or verify your current password below.</p>
        <form onSubmit={clear} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="clear-password">Current password (if needed)</Label><Input id="clear-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></div>
          <div className="space-y-2"><Label htmlFor="clear-confirmation">Type CLEAR to confirm</Label><Input id="clear-confirmation" autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-3"><Button variant="outline" type="button" disabled={busy} onClick={() => { setOpen(false); setPassword(''); }}>Keep my data</Button><Button variant="destructive" type="submit" disabled={confirmation !== 'CLEAR' || busy || disabled}>{busy ? 'Clearing statement data…' : 'Permanently clear statement data'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
