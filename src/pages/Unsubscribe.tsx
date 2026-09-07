import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import SEO from '@/components/SEO';

export default function Unsubscribe() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '');
  const [status, setStatus] = useState<'ready'|'sending'|'done'|'error'>('ready');
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
  const unsubscribe = async () => {
    if (!valid || status === 'sending') return;
    setStatus('sending');
    try {
      const {error} = await supabase.functions.invoke('unsubscribe-email', {body:{token}});
      if (error) throw error;
      window.history.replaceState(null, '', '/unsubscribe');
      setStatus('done');
    } catch { setStatus('error'); }
  };
  return <main className="mx-auto max-w-xl space-y-6 px-6 py-16">
    <SEO title="Email preferences — Casher" description="Manage Casher email preferences." path="/unsubscribe" noindex />
    <h1 className="text-3xl font-semibold">Email preferences</h1>
    {status === 'done' ? <p role="status">You have unsubscribed from Casher app emails. Account security emails may still be sent when you request them.</p> : <>
      <p>Stop app notifications sent by Casher to the address that received this email. This does not delete your account or cancel a paid subscription.</p>
      {!valid ? <p role="alert">Open the unsubscribe link in a Casher email. If you need help, contact privacy@trycasher.com.</p> : <Button onClick={unsubscribe} disabled={status==='sending'}>{status==='sending'?'Saving…':'Unsubscribe from app emails'}</Button>}
      {status==='error' && <p role="alert">Your preference could not be saved. Please try again or contact privacy@trycasher.com.</p>}
    </>}
    <Link className="block underline" to="/">Return to Casher</Link>
  </main>;
}
