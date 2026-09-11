import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import SEO from '@/components/SEO';
import { isNativeApp, authEmailReturnUrl } from '@/lib/mobile-platform';
import { nativeAuthHandoff } from '@/lib/native-auth-link';
import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';

type Mode = 'signin' | 'signup' | 'forgot' | 'recovery';
export default function Auth() {
  const native = isNativeApp();
  const location = useLocation();
  const nativeAuthPending = native && location.state?.nativeAuthPending === true;
  const handoff = native ? null : nativeAuthHandoff(window.location.search, window.location.hash);
  const recoveryLink = new URLSearchParams(window.location.search).get('mode') === 'recovery' || /type=recovery/.test(window.location.hash);
  const linkFailed = [window.location.search, window.location.hash.replace(/^#/, '?')].some(value => new URLSearchParams(value).has('error'));
  const callbackError = new URLSearchParams(window.location.search).get('error');
  const callbackFailureMessage = callbackError === 'connection'
    ? 'Could not connect to Casher to complete this link. Check your connection and request a new link on this device.'
    : callbackError === 'device'
      ? 'This link could not be completed on this device. Close and reopen Casher, then request a new link.'
      : 'This sign-in link is invalid or has expired. Sign in with your password or request a new reset link.';
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [mode, setMode] = useState<Mode>(!linkFailed && recoveryLink ? 'recovery' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const formBusy = busy || nativeAuthPending;
  const [message, setMessage] = useState(() => new URLSearchParams(window.location.search).get('deleted') === '1' ? 'Your Casher account has been deleted.' : '');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    if (linkFailed) { setMode('signin'); setRecoveryReady(false); }
    else if (recoveryLink) setMode('recovery');
  }, [recoveryLink, linkFailed]);
  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (handoff || nativeAuthPending) return;
      if (event === 'PASSWORD_RECOVERY') { setMode('recovery'); setRecoveryReady(true); setError(''); return; }
      if (session && !recoveryLink && mode !== 'recovery' && new URLSearchParams(window.location.search).get('mode') !== 'recovery') navigate('/dashboard', { replace: true });
    });
    if (nativeAuthPending) {
      setRecoveryReady(false); setError(''); setMessage(''); setPassword(''); setConfirmPassword('');
      return () => { active = false; subscription.unsubscribe(); };
    }
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active) return;
      if (handoff) return;
      if (mode === 'recovery') {
        setRecoveryReady(!!session && !error && !linkFailed);
        if (!session || error || linkFailed) setError('This reset link is invalid or has expired. Request a new link to reset your password.');
        else setError('');
      } else if (linkFailed && mode === 'signin') setError(callbackFailureMessage);
      if (session && !recoveryLink && mode !== 'recovery' && new URLSearchParams(window.location.search).get('mode') !== 'recovery') navigate('/dashboard', { replace: true });
    }).catch(() => { if (active) setError('We could not check this link. Please reload and try again.'); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [navigate, recoveryLink, mode, linkFailed, callbackFailureMessage, handoff, nativeAuthPending]);
  const switchMode = (value: Mode) => { setMode(value); setMessage(''); setError(''); setPassword(''); setConfirmPassword(''); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (formBusy) return;
    if (mode === 'recovery' && !recoveryReady) return;
    setError(''); setMessage('');
    if (mode !== 'recovery' && !z.string().email().safeParse(email.trim()).success) { setError('Enter a valid email address.'); return; }
    if (mode !== 'forgot' && password.length < (mode === 'signin' ? 1 : 8)) { setError('Use a password with at least 8 characters.'); return; }
    if (mode === 'recovery' && password !== confirmPassword) { setError('Your passwords do not match.'); return; }
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authEmailReturnUrl(window.location.origin, true) });
        if (error) throw error;
        setMessage('If an account exists for this email, you will receive a password reset link.');
      } else if (mode === 'recovery') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        navigate('/dashboard', { replace: true });
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: authEmailReturnUrl(window.location.origin) } });
        if (error) throw error;
        if (data.session) navigate('/dashboard', { replace: true });
        else setMessage('Check your email to confirm your account before signing in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      if (isAuthApiError(err) && err.code === 'over_email_send_rate_limit') setError('Email requests are temporarily limited. Please wait before requesting another link. If your account is already confirmed, you can still sign in with your password.');
      else if (isAuthRetryableFetchError(err) || err instanceof TypeError) setError('Could not connect to Casher. Check your connection and try again.');
      else setError(err instanceof Error ? err.message : 'We could not connect. Please try again.');
    }
    finally { setBusy(false); }
  };
  const signInWithGoogle = async () => {
    if (native) return;
    if (busy) return; setBusy(true); setError('');
    try {
      const { error } = await lovable.auth.signInWithOAuth('google', { redirect_uri: `${window.location.origin}/dashboard` });
      if (error) throw error;
    } catch { setError('Google sign-in could not be started. Please try email sign-in.'); }
    finally { setBusy(false); }
  };
  const heading = { signin: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password', recovery: 'Choose a new password' }[mode];
  if (handoff) return <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
    <SEO title="Continue in Casher" description="Return to Casher to complete your email link." path="/auth" noindex />
    <span className="font-serif text-4xl italic">Casher</span>
    <main className="w-full max-w-md"><Card><CardHeader><h1 className="text-2xl font-semibold">Continue in Casher</h1><CardDescription>Open the app on the device where you requested this email to finish {recoveryLink ? 'resetting your password' : 'confirming your account'}.</CardDescription></CardHeader>
      <CardContent className="space-y-4"><Button asChild className="w-full"><a href={handoff} rel="noreferrer">Open Casher</a></Button>
        <p className="text-sm text-muted-foreground">If the app does not open, check that Casher is installed on this device. If the link has expired, request a new one in the app.</p>
        <p className="text-sm text-muted-foreground">Opened this email on another device? Return to the device where you started. After confirming your email, you can also sign in using your password.</p>
        <Link to="/auth" replace onClick={() => switchMode('signin')} className="inline-flex min-h-11 items-center text-sm underline">Back to website sign in</Link>
      </CardContent></Card></main>
  </div>;
  return <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
    <SEO title={`${heading} — Casher`} description="Access your Casher account." path="/auth" noindex />
    <Link to="/" className="font-serif text-4xl italic">Casher</Link>
    <main className="w-full max-w-md"><Card><CardHeader><h1 className="text-2xl font-semibold">{heading}</h1><CardDescription>{mode === 'signin' ? 'Sign in to review your statements and subscriptions.' : mode === 'signup' ? 'Start with one free CSV upload each month.' : 'Use your email to securely regain access to your account.'}</CardDescription></CardHeader>
      <CardContent><form onSubmit={submit} className="space-y-4">
        {mode !== 'recovery' && <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={formBusy} /></div>}
        {mode !== 'forgot' && <div className="space-y-2"><Label htmlFor="password">{mode === 'recovery' ? 'New password' : 'Password'}</Label><Input id="password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={mode === 'signin' ? 1 : 8} value={password} onChange={e => setPassword(e.target.value)} required disabled={formBusy} />{mode === 'signup' && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}</div>}
        {mode === 'recovery' && <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required disabled={formBusy} /></div>}
        {nativeAuthPending && <p role="status" className="text-sm text-muted-foreground">Checking your email link…</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="rounded-md bg-muted p-3 text-sm">{message}</p>}
        <Button type="submit" className="w-full" disabled={formBusy || (mode === 'recovery' && !recoveryReady)}>{busy ? 'Please wait…' : { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link', recovery: 'Save new password' }[mode]}</Button>
      </form>
      {mode === 'signin' && <Button variant="link" className="mt-2 px-0" onClick={() => switchMode('forgot')} disabled={formBusy}>Forgot password?</Button>}
      {(mode === 'signin' || mode === 'signup') && <><div className="my-5 border-t" />{!native && <Button variant="outline" className="w-full" disabled={formBusy} onClick={signInWithGoogle}>Continue with Google</Button>}<p className="mt-5 text-center text-sm">{mode === 'signin' ? 'New to Casher?' : 'Already have an account?'} <button className="underline underline-offset-4" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} disabled={formBusy}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p></>}
      {mode === 'forgot' && <Button variant="link" onClick={() => switchMode('signin')} disabled={formBusy}>Back to sign in</Button>}
      {mode === 'recovery' && !recoveryReady && !nativeAuthPending && <Button variant="link" onClick={() => switchMode('forgot')} disabled={formBusy}>Request a new reset link</Button>}
      {native && <p className="mt-5 text-xs text-muted-foreground">Sign in with email and password. Your session is stored in your device's secure storage. Open confirmation and password-reset links on this device. If your browser opens, tap Open Casher to return to the app.</p>}<p className="mt-5 text-xs text-muted-foreground">Read our <Link to="/terms" className="underline">Terms of Service</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
    </CardContent></Card></main>
  </div>;
}
