import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStatementData } from '@/hooks/useStatementData';
import { annualSubscriptionCost, money, safeExternalUrl } from '@/lib/analytics';
import { Tables } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQueryClient } from '@tanstack/react-query';

interface Props { refreshKey?: number; userId?: string; onDataChanged?: () => void; }
export default function SubscriptionsList({ refreshKey = 0, userId, onDataChanged }: Props) {
  const { subscriptions: query } = useStatementData(userId, refreshKey);
  const [selected, setSelected] = useState<Tables<'detected_subscriptions'> | null>(null);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [error, setError] = useState('');
  const client = useQueryClient();
  const { toast, dismiss } = useToast();
  const subscriptions = (query.data || []).filter(sub => showInactive ? sub.status !== 'active' : sub.status === 'active').sort((a, b) => annualSubscriptionCost(b) - annualSubscriptionCost(a));
  const openReview = (sub: Tables<'detected_subscriptions'>) => { dismiss(); setSelected(sub); setAmount(String(sub.amount)); setFrequency(sub.frequency === 'yearly' ? 'annual' : sub.frequency); setError(''); };
  const save = async (status: string, editDetails = false) => {
    if (!selected || saving) return;
    setSaving(true); setError('');
    try {
      const { error } = await supabase.rpc('review_subscription', { _id: selected.id, _status: status,
        _amount: editDetails ? Number(amount) : Number(selected.amount), _frequency: editDetails ? frequency : selected.frequency === 'yearly' ? 'annual' : selected.frequency,
        _expected_reviewed_at: selected.reviewed_at ?? null });
      if (error) { if (['PT409', '40001'].includes(error.code)) await client.invalidateQueries({ queryKey: ['subscriptions', userId] }); setError(['PT409', '40001'].includes(error.code) ? 'This subscription changed in another window. Close this form and open it again.' : 'The subscription could not be saved. Check the amount and billing frequency, then try again.'); return; }
      setSelected(null); await client.invalidateQueries({ queryKey: ['subscriptions', userId] }); onDataChanged?.();
      toast({ title: status === 'cancelled' ? 'Marked as cancelled' : status === 'dismissed' ? 'Detection dismissed' : 'Subscription updated', description: 'Your past transactions remain unchanged.' });
    } catch { setError('Could not update the subscription. Check your connection and try again.'); }
    finally { setSaving(false); }
  };
  const url = selected ? safeExternalUrl(selected.cancellation_url) : null;
  return <Card className="min-w-0">
    <CardHeader><CardTitle>Subscriptions to review</CardTitle><CardDescription>Possible recurring payments, ordered by annual cost. Check each one with your provider.</CardDescription></CardHeader>
    <CardContent>
      <div className="mb-4 flex flex-wrap gap-2"><Button variant={!showInactive ? 'secondary' : 'ghost'} size="sm" aria-pressed={!showInactive} onClick={() => setShowInactive(false)}>Active</Button><Button variant={showInactive ? 'secondary' : 'ghost'} size="sm" aria-pressed={showInactive} onClick={() => setShowInactive(true)}>Cancelled & dismissed</Button></div>
      {query.isPending ? <p role="status">Loading subscriptions…</p> : query.isError ? <div role="alert"><p>Subscriptions could not be loaded.</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div> : subscriptions.length === 0 ? <p className="py-8 text-sm text-muted-foreground">{showInactive ? 'No cancelled or dismissed subscriptions.' : 'No active subscriptions detected. New statement uploads may reveal more.'}</p> :
        <ul className="divide-y">{subscriptions.map(sub => <li key={sub.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0">
          <div className="min-w-0 flex-1 basis-36"><h3 className="break-words text-sm font-semibold">{sub.service_name}</h3><p className="mt-1 text-sm text-muted-foreground">{money(Number(sub.amount))} · {sub.frequency}</p><p className="mt-1 text-xs text-muted-foreground">{money(annualSubscriptionCost(sub))} estimated per year</p></div>
          {showInactive && <span className="text-xs text-muted-foreground">{sub.status === 'dismissed' ? 'Not a subscription' : 'Cancelled'}</span>}
          <Button variant="outline" size="sm" onClick={() => openReview(sub)}>Review<span className="sr-only"> {sub.service_name}</span></Button>
        </li>)}</ul>}
    </CardContent>
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !saving) setSelected(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Review {selected?.service_name}</DialogTitle><DialogDescription>Casher cannot cancel payments for you. Cancel with the provider first, then update your record here.</DialogDescription></DialogHeader>
        <p className="text-sm text-muted-foreground">Check your contract, renewal date and any notice period. Keep the provider's cancellation confirmation.</p>
        {url && <Button asChild variant="outline"><a href={url} target="_blank" rel="noopener noreferrer">Open provider website<ExternalLink className="ml-2 h-4 w-4" /></a></Button>}
        {!url && <p className="text-sm">Open the provider's app or website and look for membership or billing settings.</p>}
        <form onSubmit={event => { event.preventDefault(); void save(selected?.status || 'active', true); }} className="space-y-3 border-y py-4">
          <div><Label htmlFor="subscription-amount">Amount per payment (£)</Label><Input id="subscription-amount" type="number" min="0.01" max="1923076.92" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required disabled={saving} /></div>
          <div><Label htmlFor="subscription-frequency">Billing frequency</Label><select id="subscription-frequency" value={frequency} onChange={e => setFrequency(e.target.value)} disabled={saving} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="monthly">Monthly</option><option value="annual">Yearly</option><option value="weekly">Weekly</option><option value="fortnightly">Every two weeks</option><option value="quarterly">Every three months</option></select></div>
          <p className="text-xs text-muted-foreground">Corrections to amount or frequency are kept when you upload more statements.</p>
          <Button type="submit" variant="outline" disabled={saving}>Save payment details</Button>
        </form>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {selected?.status === 'active' ? <><Button disabled={saving} onClick={() => save('cancelled')}>{saving ? 'Saving…' : 'I cancelled with the provider'}</Button><Button variant="outline" disabled={saving} onClick={() => save('dismissed')}>This is not a subscription</Button></> : <Button disabled={saving} onClick={() => save('active')}>Restore as active subscription</Button>}
      </DialogContent>
    </Dialog>
  </Card>;
}
