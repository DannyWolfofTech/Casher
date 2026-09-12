import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@/integrations/supabase/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatSignedAmount } from '@/lib/transactions';
import MerchantMark from './MerchantMark';
import { resolveMerchant } from '@/lib/merchant-identity';

export default function TransactionReview({ row, onClose }: { row: Tables<'transactions'>; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [direction, setDirection] = useState(row.direction || '');
  const [category, setCategory] = useState(row.category || 'Other');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const client = useQueryClient();
  const merchant = resolveMerchant(row.description, row.merchant);
  const recordedDirection = row.direction === 'credit' || row.direction === 'debit' ? row.direction : null;
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const { error } = await supabase.rpc('review_transaction', { _id: row.id, _direction: direction, _category: category.trim(), _expected_reviewed_at: row.reviewed_at ?? null });
      if (error) { if (['PT409', '40001'].includes(error.code)) await client.invalidateQueries({ queryKey: ['transactions', row.user_id] }); setError(['PT409', '40001'].includes(error.code) ? 'This transaction changed in another window. Close this form and open it again.' : 'The correction could not be saved. Please try again.'); return; }
      await client.invalidateQueries({ queryKey: ['transactions', row.user_id] });
      onClose();
    } catch { setError('The correction could not be saved. Check your connection and try again.'); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent><DialogHeader>
    <DialogTitle>Transaction details</DialogTitle><DialogDescription>Compare this payment with your original statement. Your correction updates the totals and keeps the imported values on record.</DialogDescription>
  </DialogHeader>
    <div className="flex min-w-0 items-center gap-3"><MerchantMark merchant={merchant} category={category} /><p className="min-w-0 break-words font-medium">{merchant?.name || row.description}</p></div>
    <p className="app-amount">{formatSignedAmount({ ...row, direction: recordedDirection })}</p><dl className="space-y-3"><div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Date</dt><dd>{new Date(`${row.date}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Category</dt><dd>{row.category || 'Other'}</dd></div><div className="space-y-1"><dt className="app-caption">Original statement description</dt><dd className="break-words text-sm">{row.description}</dd></div></dl>{!recordedDirection && <p role="note" className="text-sm text-muted-foreground">This older transaction has an estimated payment direction. Check the original statement.</p>}
    <Button variant="soft" onClick={() => setEditing(value => !value)} aria-expanded={editing} aria-controls="transaction-correction">{editing ? 'Hide correction form' : 'Edit transaction'}</Button>
    {editing && <form id="transaction-correction" onSubmit={save} className="space-y-4">
      <div><Label htmlFor="review-direction">Payment direction</Label><select id="review-direction" required value={direction} onChange={e => setDirection(e.target.value)} disabled={busy} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="" disabled>Choose from your statement</option><option value="debit">Money out</option><option value="credit">Money in</option></select></div>
      <div><Label htmlFor="review-category">Category</Label><Input id="review-category" value={category} onChange={e => setCategory(e.target.value)} maxLength={80} required disabled={busy} /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Keep current values</Button><Button type="submit" disabled={busy || !direction || !category.trim()}>{busy ? 'Saving…' : 'Save correction'}</Button></div>
    </form>}
  </DialogContent></Dialog>;
}
