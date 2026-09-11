import { readRequest } from '@/lib/read-request';
import { createContext, createElement, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import { resolveUploadAllowance, type UploadUsage } from '@/lib/upload-allowance';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const useAccountState = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState('free');
  const [uploadsUsed, setUploadsUsed] = useState(0);
  const [allowanceReady, setAllowanceReady] = useState(false);
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
      // Confirm usage first; billing reconciliation must not block navigation.
      const readUsage = async () => {
        const result = await readRequest(signal => supabase.rpc('get_upload_usage').abortSignal(signal).retry(false));
        if (!current()) return;
        const usage = result.data?.[0] as UploadUsage | undefined;
        if (result.error || !usage || !Number.isFinite(Number(usage.uploads_used)) || Number(usage.uploads_used) < 0
            || (usage.upload_limit !== null && (!Number.isFinite(Number(usage.upload_limit)) || Number(usage.upload_limit) < 0))) throw new Error('Allowance unavailable');
        const allowance = resolveUploadAllowance(usage);
        setUserTier(allowance.tier); setUploadsUsed(allowance.uploadsUsed); setCanUpload(allowance.canUpload); setAllowanceReady(true);
        return allowance;
      };
      const allowance = await readUsage();
      if (!allowance || !current()) return;
      setAccountError('');
      try {
        const key = 'casher:onboarding:' + id;
        if (allowance.uploadsUsed === 0 && !localStorage.getItem(key)) { setShowOnboarding(true); localStorage.setItem(key, 'true'); }
      } catch { /* Storage restrictions must not block account access. */ }
      if (syncBilling) {
        let billingFailed = false;
        try { const result = await readRequest(signal => supabase.functions.invoke('check-subscription', { signal })); billingFailed = !!result.error; }
        catch { billingFailed = true; }
        if (!current()) return;
        if (billingFailed) setAccountError('Billing could not be refreshed. Your last confirmed plan is shown. Retry before changing your plan.');
        else await readUsage();
      }
    } catch {
      if (current()) { setCanUpload(false); setAllowanceReady(false); setAccountError('Your upload allowance could not be loaded. Retry to check your plan and uploads.'); }
    } finally {
      if (current()) setRefreshingAccount(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const invalidate = () => { ++generation.current; identity.current = null; };
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const applyUser = (next: User | null) => {
      if (!active) return;
      const changed = identity.current !== (next?.id || null);
      if (changed || !next) { ++generation.current; queryClient.clear(); setUserTier('free'); setUploadsUsed(0); setCanUpload(false); setAllowanceReady(false); setRefreshingAccount(false); setShowOnboarding(false); setAccountError(''); }
      identity.current = next?.id || null; setUser(next);
      setLoading(false);
      if (next && changed) void loadAccount(next.id, true);
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
  }, [loadAccount, queryClient]);

  const refreshAccount = () => { if (identity.current) void loadAccount(identity.current, true); };
  const refreshUploadAllowance = () => { if (identity.current) void loadAccount(identity.current); };
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      ++generation.current; identity.current = null; queryClient.clear(); navigate('/auth', { replace: true });
    } catch { toast({ title: 'Sign-out failed', description: 'Check your connection and try again.', variant: 'destructive' }); }
  };
  return { user, loading, userTier, uploadsUsed, canUpload, allowanceReady, accountError, refreshingAccount, refreshAccount, refreshUploadAllowance,
    showOnboarding, setShowOnboarding, setUploadsUsed, setCanUpload, setUserTier, handleSignOut };
};

// One account lifetime for the app, instead of a new identity/cache on every route.
const AuthContext = createContext<ReturnType<typeof useAccountState> | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  return createElement(AuthContext.Provider, { value: useAccountState() }, children);
}
export function useAuth(redirectOnSignOut = true) {
  const account = useContext(AuthContext);
  const navigate = useNavigate();
  const user = account?.user;
  const loading = account?.loading ?? true;
  useEffect(() => {
    if (redirectOnSignOut && !loading && !user) navigate('/auth', { replace: true });
  }, [loading, user, navigate, redirectOnSignOut]);
  if (!account) throw new Error('useAuth requires AuthProvider');
  return account;
}
