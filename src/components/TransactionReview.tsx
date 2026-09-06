import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@/integrations/supabase/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { money } from '@/lib/analytics';

export default function TransactionReview({ row, onClose }: { row: Tables<'transactions'>; onClose: () => void }) {
  const [direction, setDirection] = useState(row.direction || '');
  const [category, setCategory] = useState(row.category || 'Other');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const client = useQueryClient();
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
    <DialogTitle>Review transaction</DialogTitle><DialogDescription>Compare this payment with your original statement. Your correction updates the totals and keeps the imported values on record.</DialogDescription>
  </DialogHeader><p className="break-words text-sm">{row.date} · {row.description} · {money(Math.abs(row.amount))}</p>
    <form onSubmit={save} className="space-y-4">
      <div><Label htmlFor="review-direction">Payment direction</Label><select id="review-direction" required value={direction} onChange={e => setDirection(e.target.value)} disabled={busy} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="" disabled>Choose from your statement</option><option value="debit">Money out</option><option value="credit">Money in</option></select></div>
      <div><Label htmlFor="review-category">Category</Label><Input id="review-category" value={category} onChange={e => setCategory(e.target.value)} maxLength={80} required disabled={busy} /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Keep current values</Button><Button type="submit" disabled={busy || !direction || !category.trim()}>{busy ? 'Saving…' : 'Save correction'}</Button></div>
    </form>
  </DialogContent></Dialog>;
}
