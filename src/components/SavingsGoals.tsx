import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { money } from '@/lib/analytics';
import type { Tables } from '@/integrations/supabase/types';

export default function SavingsGoals({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<'savings_goals'> | null>(null);
  const [deleting, setDeleting] = useState<Tables<'savings_goals'> | null>(null);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('0');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState('');
  const { toast } = useToast();
  const query = useQuery({ queryKey: ['savings-goals', userId], retry: 1, queryFn: async () => {
    const { data, error } = await supabase.from('savings_goals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error; return data || [];
  } });
  const showEditor = (goal: Tables<'savings_goals'> | null) => {
    setEditing(goal); setTitle(goal?.title || ''); setTarget(goal ? String(goal.target_amount) : ''); setSaved(String(goal?.current_amount || 0)); setDeadline(goal?.deadline || ''); setValidation(''); setOpen(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const targetValue = Number(target), savedValue = Number(saved);
    if (!title.trim() || !Number.isFinite(targetValue) || targetValue <= 0 || !Number.isFinite(savedValue) || savedValue < 0) { setValidation('Enter a title, a target above £0, and a saved amount of £0 or more.'); return; }
    if (busy) return; setBusy(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || user.id !== userId) throw new Error('Please sign in again.');
      const values = { title: title.trim(), target_amount: targetValue, current_amount: savedValue, deadline: deadline || null };
      const { data, error } = editing ? await supabase.from('savings_goals').update(values).eq('id', editing.id).eq('user_id', user.id).select('id').single() : await supabase.from('savings_goals').insert({ ...values, user_id: user.id }).select('id').single();
      if (error || !data) throw error || new Error('Goal unavailable');
      setOpen(false); await query.refetch();
    } catch { setValidation('We could not save this goal. Please try again.'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!deleting || busy) return; setBusy(true);
    try {
      const { data, error } = await supabase.from('savings_goals').delete().eq('id', deleting.id).eq('user_id', userId).select('id').single();
      if (error || !data) throw error || new Error('Goal unavailable'); setDeleting(null); await query.refetch();
    } catch { toast({ title: 'Could not delete goal', description: 'Please try again.', variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return <Card className="min-w-0"><CardHeader><div className="flex flex-wrap justify-between gap-3"><div><CardTitle>Savings goals</CardTitle><CardDescription>Set a target and update what you have saved.</CardDescription></div><Button size="sm" onClick={() => showEditor(null)}>Add goal</Button></div></CardHeader>
    <CardContent>{query.isPending ? <p role="status">Loading goals…</p> : query.isError ? <div role="alert"><p>Goals could not be loaded.</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div> : !query.data?.length ? <p className="py-6 text-sm text-muted-foreground">No goals yet. Set a target to start tracking your progress.</p> : <ul className="space-y-5">{query.data.map(goal => {
      const progress = goal.target_amount > 0 ? Math.min(100, Math.max(0, goal.current_amount / goal.target_amount * 100)) : 0;
      return <li key={goal.id}><div className="flex flex-wrap justify-between gap-2"><h3 className="break-words font-medium">{goal.title}</h3><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => showEditor(goal)}>Update</Button><Button variant="ghost" size="sm" onClick={() => setDeleting(goal)}>Delete</Button></div></div><p className="mb-2 text-sm text-muted-foreground">{money(goal.current_amount)} of {money(goal.target_amount)}</p><Progress aria-label={`${goal.title}: ${progress.toFixed(0)}% complete`} value={progress} /><p className="mt-2 text-xs text-muted-foreground">{progress.toFixed(0)}% complete{goal.deadline ? ` · Due ${new Date(goal.deadline + 'T12:00:00').toLocaleDateString('en-GB')}` : ''}</p></li>;
    })}</ul>}</CardContent>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent><DialogHeader><DialogTitle>{editing ? 'Update savings goal' : 'Create savings goal'}</DialogTitle><DialogDescription>Your saved amount is entered manually.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4">
      <div><Label htmlFor="goal-title">Goal title</Label><Input id="goal-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required /></div>
      <div><Label htmlFor="goal-target">Target amount (£)</Label><Input id="goal-target" type="number" min="0.01" max="99999999.99" step="0.01" required value={target} onChange={e => setTarget(e.target.value)} /></div>
      <div><Label htmlFor="goal-saved">Already saved (£)</Label><Input id="goal-saved" type="number" min="0" max="99999999.99" step="0.01" required value={saved} onChange={e => setSaved(e.target.value)} /></div>
      <div><Label htmlFor="goal-deadline">Deadline (optional)</Label><Input id="goal-deadline" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></div>
      {validation && <p role="alert" className="text-sm text-destructive">{validation}</p>}<Button type="submit" disabled={busy} className="w-full">{busy ? 'Saving…' : 'Save goal'}</Button>
    </form></DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={value => { if (!value && !busy) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>Delete {deleting?.title}?</DialogTitle><DialogDescription>This permanently removes this goal and its recorded progress.</DialogDescription></DialogHeader><div className="flex justify-end gap-3"><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Keep goal</Button><Button variant="destructive" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete goal'}</Button></div></DialogContent></Dialog>
  </Card>;
}
