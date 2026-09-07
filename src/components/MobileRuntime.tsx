import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isNativeApp, nativeLifecycle } from '@/lib/mobile-platform';
import { parseNativeAuthLink } from '@/lib/native-auth-link';
import { supabase } from '@/integrations/supabase/client';
import { clearExpiredExports } from '@/lib/save-file';

export default function MobileRuntime() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const seen = useRef(new Set<string>());
  const cache = useQueryClient();
  const [offline,setOffline] = useState(!navigator.onLine);
  const [problem,setProblem] = useState('');
  useEffect(()=>{
    const online=()=>setOffline(!navigator.onLine);
    window.addEventListener('online',online); window.addEventListener('offline',online);
    if (!isNativeApp()) return ()=>{ window.removeEventListener('online',online); window.removeEventListener('offline',online); };
    document.documentElement.classList.add('native-app');
    void clearExpiredExports().catch(() => setProblem('Temporary exports could not be cleaned up. Close and reopen Casher.'));
    let disposed=false;
    let remove:(()=>Promise<void>)|undefined;
    const navigate = (to: string, options?: {replace?:boolean}) => navigateRef.current(to, options);
    const callback=async(value:string)=>{
      const link=parseNativeAuthLink(value);
      if (!link || disposed) return;
      if ('error' in link) { navigate('/auth?error=callback',{replace:true}); return; }
      if (seen.current.has(link.code)) return;
      seen.current.add(link.code);
      // Establish the recovery route before Auth receives the session event.
      navigate(link.recovery?'/auth?mode=recovery':'/auth',{replace:true});
      const result=await supabase.auth.exchangeCodeForSession(link.code);
      if (disposed) return;
      if(result.error) { navigate('/auth?error=callback',{replace:true}); return; }
      cache.clear(); navigate(link.recovery?'/auth?mode=recovery':'/dashboard',{replace:true});
    };
    void nativeLifecycle({
      onUrl: value=>{void callback(value).catch(()=>setProblem('This sign-in link could not be completed. Request a new link on this device.'));},
      onState: active=>{
        if(active) {
          supabase.auth.startAutoRefresh();
          void supabase.auth.getSession().then(()=>cache.invalidateQueries()).catch(()=>setProblem('Your session could not be restored. Sign in again.'));
        } else { supabase.auth.stopAutoRefresh(); }
      },
      onBack: ()=>{
        if(document.querySelector('[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"]')) {
          document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return true;
        }
        if (!['/auth','/dashboard'].includes(window.location.pathname)) {
          if (typeof window.history.state?.idx === 'number' && window.history.state.idx > 0) navigateRef.current(-1);
          else navigate('/dashboard',{replace:true});
          return true;
        }
        return false;
      },
    }).then(async cleanup=>{if(disposed) await cleanup(); else remove=cleanup;}).catch(()=>setProblem('Device services could not start. Close and reopen Casher.'));
    return ()=>{disposed=true; void remove?.(); window.removeEventListener('online',online); window.removeEventListener('offline',online);};
  },[cache]);
  if(!offline&&!problem) return null;
  return <div role="status" className="border-b bg-muted px-4 py-3 text-center text-sm">{offline?'You are offline. Reconnect before importing files or changing your account.':problem}{problem&&!offline&&<button className="ml-3 underline" onClick={()=>setProblem('')}>Dismiss</button>}</div>;
}
