import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import { resolveUploadAllowance, type UploadUsage } from '@/lib/upload-allowance';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userTier, setUserTier] = useState('free');
  const [uploadsUsed, setUploadsUsed] = useState(0);
  const [canUpload, setCanUpload] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [refreshingAccount, setRefreshingAccount] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const identity = useRef<string | null>(null);
  const generation = useRef(0);

  const loadAccount = useCallback(async (id: string, syncBilling = false) => {
    const request = ++generation.current;
    const current = () => generation.current === request && identity.current === id;
    setRefreshingAccount(true);
    try {
      let billingFailed = false;
      if (syncBilling) {
        try { const result = await supabase.functions.invoke('check-subscription'); billingFailed = !!result.error; }
        catch { billingFailed = true; }
      }
      if (!current()) return;
      const [roles, result] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', id).eq('role', 'admin').maybeSingle().retry(false),
        supabase.rpc('get_upload_usage').retry(false),
      ]);
      if (!current()) return;
      setIsAdmin(!roles.error && !!roles.data);
      const usage = result.data?.[0] as UploadUsage | undefined;
      if (result.error || !usage || !Number.isFinite(Number(usage.uploads_used)) || Number(usage.uploads_used) < 0
          || (usage.upload_limit !== null && (!Number.isFinite(Number(usage.upload_limit)) || Number(usage.upload_limit) < 0))) throw new Error('Allowance unavailable');
      const allowance = resolveUploadAllowance(usage);
      setUserTier(allowance.tier); setUploadsUsed(allowance.uploadsUsed); setCanUpload(allowance.canUpload);
      setAccountError(billingFailed ? 'Billing could not be refreshed. Your last confirmed plan is shown. Retry before changing your plan.' : '');
      try {
        const key = 'casher:onboarding:' + id;
        if (allowance.uploadsUsed === 0 && !localStorage.getItem(key)) { setShowOnboarding(true); localStorage.setItem(key, 'true'); }
      } catch { /* Storage restrictions must not block account access. */ }
    } catch {
      if (current()) { setCanUpload(false); setAccountError('Your upload allowance could not be loaded. Retry to check your plan and uploads.'); }
    } finally {
      if (current()) { setLoading(false); setRefreshingAccount(false); }
    }
  }, []);

  useEffect(() => {
    let active = true;
    const invalidate = () => { ++generation.current; identity.current = null; };
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const applyUser = (next: User | null) => {
      if (!active) return;
      const changed = identity.current !== (next?.id || null);
      if (changed) { ++generation.current; queryClient.clear(); setIsAdmin(false); setUserTier('free'); setUploadsUsed(0); setCanUpload(false); setShowOnboarding(false); setAccountError(''); }
      identity.current = next?.id || null; setUser(next);
      if (!next) { setLoading(false); navigate('/auth', { replace: true }); return; }
      if (changed) { setLoading(true); void loadAccount(next.id, true); }
    };
    // Supabase callbacks run under a session lock; defer account requests.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const timer = setTimeout(() => { timers.delete(timer); applyUser(session?.user || null); }, 0); timers.add(timer);
    });
    const initialGeneration = generation.current;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && initialGeneration === generation.current) applyUser(error ? null : data.session?.user || null);
    }).catch(() => { if (active && initialGeneration === generation.current) applyUser(null); });
    return () => { active = false; invalidate(); timers.forEach(clearTimeout); subscription.unsubscribe(); };
  }, [loadAccount, navigate, queryClient]);

  const refreshAccount = () => { if (identity.current) void loadAccount(identity.current, true); };
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      ++generation.current; identity.current = null; queryClient.clear(); navigate('/auth', { replace: true });
    } catch { toast({ title: 'Sign-out failed', description: 'Check your connection and try again.', variant: 'destructive' }); }
  };
  return { user, loading, isAdmin, userTier, uploadsUsed, canUpload, accountError, refreshingAccount, refreshAccount,
    showOnboarding, setShowOnboarding, setUploadsUsed, setCanUpload, setUserTier, handleSignOut };
};
