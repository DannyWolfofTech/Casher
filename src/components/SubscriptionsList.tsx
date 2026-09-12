import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStatementData } from '@/hooks/useStatementData';
import { annualSubscriptionCost, money, monthLabel } from '@/lib/analytics';
import { nextRenewal, cancellationProvider } from '@/lib/subscription-renewals';
import { Tables } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQueryClient } from '@tanstack/react-query';
import MerchantMark from './MerchantMark';
import { resolveMerchant } from '@/lib/merchant-identity';

interface Props { refreshKey?: number; userId?: string; onDataChanged?: () => void; }
export default function SubscriptionsList({ refreshKey = 0, userId, onDataChanged }: Props) {
  const { subscriptions: query } = useStatementData(userId, refreshKey);
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmStatus, setConfirmStatus] = useState<'cancelled' | 'dismissed' | null>(null);
  const [editingDetails, setEditingDetails] = useState(false);
  const [selected, setSelected] = useState<Tables<'detected_subscriptions'> | null>(null);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [error, setError] = useState('');
  const client = useQueryClient();
  const { toast, dismiss } = useToast();
  const subscriptions = (query.data || []).filter(sub => showInactive ? sub.status !== 'active' : sub.status === 'active').sort((a, b) => annualSubscriptionCost(b) - annualSubscriptionCost(a));
  const openReview = (sub: Tables<'detected_subscriptions'>) => { dismiss(); setConfirmStatus(null); setEditingDetails(false); setSelected(sub); setAmount(String(sub.amount)); setFrequency(sub.frequency === 'yearly' ? 'annual' : sub.frequency); setError(''); };
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
  const provider = selected ? cancellationProvider(selected.service_name) : null;
  const selectedMerchant = selected ? resolveMerchant(selected.service_name) : null;
  useEffect(() => {
    const id = searchParams.get('renewal');
    const sub = query.data?.find(row => row.id === id);
    if (sub) { setSelected(sub); setAmount(String(sub.amount)); setFrequency(sub.frequency === 'yearly' ? 'annual' : sub.frequency); setEditingDetails(false); setConfirmStatus(null); setError(''); setSearchParams({}, {replace:true}); }
  }, [query.data, searchParams, setSearchParams]);
  const active = (query.data || []).filter(sub => sub.status === 'active');
  const annual = active.reduce((sum, sub) => sum + annualSubscriptionCost(sub), 0);
  const ordered = subscriptions.map(sub => ({sub, due: nextRenewal(sub)})).sort((a,b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const groups = [...new Set(ordered.map(item => item.due?.slice(0,7) || 'unknown'))];
  return <div className="min-w-0 space-y-6">
    <div className="space-y-4"><h1 className="app-title">Subscriptions</h1><p className="text-[.9375rem] text-muted-foreground">Upcoming recurring payments</p></div>
    {!query.isPending && !query.isError && <dl className="summary-pair rounded-2xl bg-card p-4"><div><dt>Monthly estimate</dt><dd>{money(annual / 12)}</dd></div><div><dt>Annual estimate</dt><dd>{money(annual)}</dd></div></dl>}
    <div className="segmented-control"><Button variant={!showInactive ? 'soft' : 'ghost'} size="sm" aria-pressed={!showInactive} onClick={() => setShowInactive(false)}>Active</Button><Button variant={showInactive ? 'soft' : 'ghost'} size="sm" aria-pressed={showInactive} onClick={() => setShowInactive(true)}>Cancelled &amp; dismissed</Button></div>
    {query.isPending ? <p role="status">Loading subscriptions…</p> : query.isError ? <div role="alert"><p>Subscriptions could not be loaded.</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div> : subscriptions.length === 0 ? <p className="py-8 text-muted-foreground">{showInactive ? 'No cancelled or dismissed subscriptions.' : 'No active subscriptions detected. New statement uploads may reveal more.'}</p> : <section aria-label="Expected renewals" className="space-y-5"><h2 className="app-section-title">{showInactive ? 'Past detections' : 'Next payments'}</h2>{groups.map(group => <section key={group}><h3 className="text-[.9375rem] text-muted-foreground">{group === 'unknown' ? 'Date not available' : monthLabel(group)} · {ordered.filter(item => (item.due?.slice(0,7) || 'unknown') === group).length} {showInactive ? 'records' : 'expected'}</h3><ul className="divide-y">{ordered.filter(item => (item.due?.slice(0,7) || 'unknown') === group).map(({sub,due}) => {
      const merchant = resolveMerchant(sub.service_name); const name = merchant?.name || sub.service_name;
      return <li key={sub.id}><button type="button" className="merchant-row rounded" onClick={() => openReview(sub)} aria-label={`Manage ${name}`} aria-describedby={`renewal-summary-${sub.id}`}><span id={`renewal-summary-${sub.id}`} className="sr-only">{money(Number(sub.amount))}, {sub.frequency}. {showInactive ? sub.status : `Estimated next payment ${due || "date unavailable"}` }.</span><MerchantMark merchant={merchant} category="Subscription" /><span className="merchant-row-label">{name}<span className="merchant-row-detail">{showInactive ? sub.status === 'cancelled' ? 'Cancelled' : 'Not a subscription' : due ? new Date(`${due}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : 'No date'} · {sub.frequency}</span></span><span className="merchant-row-amount">{money(Number(sub.amount))}</span><ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" /></button></li>;
    })}</ul></section>)}</section>}
    <p className="app-caption">Expected dates come from past payments. Casher does not schedule these charges. Estimates, not confirmed bills. Older statements cannot confirm whether a subscription is still running.</p>
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !saving) setSelected(null); }}>
      <DialogContent><DialogHeader><DialogTitle>{selectedMerchant?.name || selected?.service_name || 'Renewal details'}</DialogTitle><DialogDescription>Casher cannot cancel payments for you. Cancel with the provider first, then update your record here.</DialogDescription></DialogHeader>
        {selected && <div className="flex min-w-0 items-center gap-3"><MerchantMark merchant={selectedMerchant} category="Subscription" /><p className="min-w-0 break-words text-sm"><span className="block text-xs text-muted-foreground">Statement description</span>{selected.service_name}</p></div>}
        {selected && <dl className="space-y-3"><div><dt className="app-caption">Estimated payment</dt><dd className="app-amount">{money(Number(selected.amount))}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt>Frequency</dt><dd>{selected.frequency}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt>Next expected</dt><dd>{nextRenewal(selected) || 'Date unavailable'}</dd></div></dl>}
        <p className="text-sm text-muted-foreground">Check your contract, renewal date and any notice period. Keep the provider's cancellation confirmation.</p>
        {provider && <Button asChild><a href={provider!.url} target="_blank" rel="noopener noreferrer">Continue to {provider?.name} cancellation<ExternalLink className="ml-2 h-4 w-4" /></a></Button>}
        {!provider && <p className="text-sm">We haven't verified a cancellation link for this merchant. Use the provider's official app or the contact details on your bill. Do not cancel a direct debit as a substitute for ending your contract.</p>}
        <div><Button type="button" variant="ghost" className="w-full justify-start text-left" aria-expanded={editingDetails} aria-controls="subscription-details" onClick={() => setEditingDetails(value => !value)}><ChevronDown aria-hidden="true" className={editingDetails ? "rotate-180" : ""} />Edit detected payment details</Button>{editingDetails && <form id="subscription-details" onSubmit={event => { event.preventDefault(); void save(selected?.status || 'active', true); }} className="space-y-3 border-y py-4">
          <div><Label htmlFor="subscription-amount">Amount per payment (£)</Label><Input id="subscription-amount" type="number" inputMode="decimal" min="0.01" max="1923076.92" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required disabled={saving} /></div>
          <div><Label htmlFor="subscription-frequency">Billing frequency</Label><select id="subscription-frequency" value={frequency} onChange={e => setFrequency(e.target.value)} disabled={saving} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="monthly">Monthly</option><option value="annual">Yearly</option><option value="weekly">Weekly</option><option value="fortnightly">Every two weeks</option><option value="quarterly">Every three months</option></select></div>
          <p className="text-xs text-muted-foreground">Corrections to amount or frequency are kept when you upload more statements.</p>
          <Button type="submit" variant="outline" disabled={saving}>Save payment details</Button>
        </form>}</div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {selected?.status === 'active' ? <><Button variant="outline" disabled={saving} onClick={() => setConfirmStatus('cancelled')}>{saving ? 'Saving…' : 'I cancelled with the provider'}</Button><Button variant="outline" disabled={saving} onClick={() => setConfirmStatus('dismissed')}>This is not a subscription</Button></> : <Button disabled={saving} onClick={() => save('active')}>Restore as active subscription</Button>}
      </DialogContent>
    </Dialog>
    <Dialog open={!!confirmStatus} onOpenChange={open => { if (!open && !saving) setConfirmStatus(null); }}><DialogContent><DialogHeader><DialogTitle>{confirmStatus === 'cancelled' ? 'Mark as cancelled?' : 'Dismiss this detection?'}</DialogTitle><DialogDescription>{confirmStatus === 'cancelled' ? 'Only continue after cancelling with the provider. This changes your Casher record; it does not stop a payment.' : 'This removes the detection from active subscriptions. Your recorded transactions stay unchanged.'}</DialogDescription></DialogHeader>{error && <p role="alert" className="text-destructive">{error}</p>}<Button variant="soft" onClick={() => setConfirmStatus(null)} disabled={saving}>Keep current record</Button><Button disabled={saving} onClick={async () => { if (confirmStatus) await save(confirmStatus); setConfirmStatus(null); }}>{saving ? 'Saving…' : confirmStatus === 'cancelled' ? 'Mark as cancelled' : 'Dismiss detection'}</Button></DialogContent></Dialog>
  </div>;
}
