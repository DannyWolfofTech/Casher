import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import SEO from '@/components/SEO';

type Mode = 'signin' | 'signup' | 'forgot' | 'recovery';
export default function Auth() {
  const recoveryLink = new URLSearchParams(window.location.search).get('mode') === 'recovery' || /type=recovery/.test(window.location.hash);
  const [linkFailed] = useState(() => [window.location.search, window.location.hash.replace(/^#/, '?')].some(value => new URLSearchParams(value).has('error')));
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [mode, setMode] = useState<Mode>(recoveryLink ? 'recovery' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { setMode('recovery'); setRecoveryReady(true); setError(''); return; }
      if (session && !recoveryLink && mode !== 'recovery') navigate('/dashboard', { replace: true });
    });
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active) return;
      if (mode === 'recovery') {
        setRecoveryReady(!!session && !error && !linkFailed);
        if (!session || error || linkFailed) setError('This reset link is invalid or has expired. Request a new link to reset your password.');
      } else if (linkFailed && mode === 'signin') setError('This sign-in link is invalid or has expired. Sign in with your password or request a new reset link.');
      if (session && !recoveryLink && mode !== 'recovery') navigate('/dashboard', { replace: true });
    }).catch(() => { if (active) setError('We could not check this link. Please reload and try again.'); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [navigate, recoveryLink, mode, linkFailed]);
  const switchMode = (value: Mode) => { setMode(value); setMessage(''); setError(''); setPassword(''); setConfirmPassword(''); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    if (mode === 'recovery' && !recoveryReady) return;
    setError(''); setMessage('');
    if (mode !== 'recovery' && !z.string().email().safeParse(email.trim()).success) { setError('Enter a valid email address.'); return; }
    if (mode !== 'forgot' && password.length < (mode === 'signin' ? 1 : 8)) { setError('Use a password with at least 8 characters.'); return; }
    if (mode === 'recovery' && password !== confirmPassword) { setError('Your passwords do not match.'); return; }
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth?mode=recovery` });
        if (error) throw error;
        setMessage('If an account exists for this email, you will receive a password reset link.');
      } else if (mode === 'recovery') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        navigate('/dashboard', { replace: true });
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth` } });
        if (error) throw error;
        if (data.session) navigate('/dashboard', { replace: true });
        else setMessage('Check your email to confirm your account before signing in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate('/dashboard', { replace: true });
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'We could not connect. Please try again.'); }
    finally { setBusy(false); }
  };
  const signInWithGoogle = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      const { error } = await lovable.auth.signInWithOAuth('google', { redirect_uri: `${window.location.origin}/dashboard` });
      if (error) throw error;
    } catch { setError('Google sign-in could not be started. Please try email sign-in.'); }
    finally { setBusy(false); }
  };
  const heading = { signin: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password', recovery: 'Choose a new password' }[mode];
  return <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
    <SEO title={`${heading} — Casher`} description="Access your Casher account." path="/auth" noindex />
    <Link to="/" className="font-serif text-4xl italic">Casher</Link>
    <main className="w-full max-w-md"><Card><CardHeader><h1 className="text-2xl font-semibold">{heading}</h1><CardDescription>{mode === 'signin' ? 'Sign in to review your statements and subscriptions.' : mode === 'signup' ? 'Start with one free CSV upload each month.' : 'Use your email to securely regain access to your account.'}</CardDescription></CardHeader>
      <CardContent><form onSubmit={submit} className="space-y-4">
        {mode !== 'recovery' && <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={busy} /></div>}
        {mode !== 'forgot' && <div className="space-y-2"><Label htmlFor="password">{mode === 'recovery' ? 'New password' : 'Password'}</Label><Input id="password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={mode === 'signin' ? 1 : 8} value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} />{mode === 'signup' && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}</div>}
        {mode === 'recovery' && <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required disabled={busy} /></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="rounded-md bg-muted p-3 text-sm">{message}</p>}
        <Button type="submit" className="w-full" disabled={busy || (mode === 'recovery' && !recoveryReady)}>{busy ? 'Please wait…' : { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link', recovery: 'Save new password' }[mode]}</Button>
      </form>
      {mode === 'signin' && <Button variant="link" className="mt-2 px-0" onClick={() => switchMode('forgot')} disabled={busy}>Forgot password?</Button>}
      {(mode === 'signin' || mode === 'signup') && <><div className="my-5 border-t" /><Button variant="outline" className="w-full" disabled={busy} onClick={signInWithGoogle}>Continue with Google</Button><p className="mt-5 text-center text-sm">{mode === 'signin' ? 'New to Casher?' : 'Already have an account?'} <button className="underline underline-offset-4" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} disabled={busy}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p></>}
      {mode === 'forgot' && <Button variant="link" onClick={() => switchMode('signin')} disabled={busy}>Back to sign in</Button>}
      {mode === 'recovery' && !recoveryReady && <Button variant="link" onClick={() => switchMode('forgot')} disabled={busy}>Request a new reset link</Button>}
      <p className="mt-5 text-xs text-muted-foreground">Read how we handle your data in our <Link to="/privacy" className="underline">privacy policy</Link>.</p>
    </CardContent></Card></main>
  </div>;
}
