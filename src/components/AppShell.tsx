import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, WifiOff } from 'lucide-react';
import { Button } from './ui/button';
import home from '@/assets/navigation/home.svg';
import activity from '@/assets/navigation/activity.svg';
import repeat from '@/assets/navigation/repeat.svg';
import goal from '@/assets/navigation/goal.svg';
import person from '@/assets/navigation/person.svg';
import plus from '@/assets/navigation/plus.svg';

const destinations = [
  { label: 'Overview', path: '/dashboard', icon: home },
  { label: 'Activity', path: '/dashboard/activity', icon: activity },
  { label: 'Subscriptions', path: '/dashboard/subscriptions', icon: repeat },
  { label: 'Goals', path: '/dashboard/goals', icon: goal },
];

export function NavigationIcon({ source }: { source: string }) {
  return <span aria-hidden="true" className="navigation-icon" style={{ maskImage: `url("${source}")`, WebkitMaskImage: `url("${source}")` }} />;
}

export default function AppShell({ children, back, onImport, importing = false }: { children: ReactNode; back?: string; onImport?: () => void; importing?: boolean }) {
  const { pathname } = useLocation();
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return <div className="casher-app min-h-screen bg-background">
    <a className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-4 focus:z-50 focus:bg-card focus:p-3" href="#main-content">Skip to content</a>
    <header className="app-header">
      <div className="app-header-inner">
        {back ? <Button variant="link" asChild className="px-0"><Link to={back}><ChevronLeft aria-hidden="true" />Back<span className="sr-only"> to {back === '/account' ? 'account' : 'overview'}</span></Link></Button> : <Link to="/dashboard" className="app-wordmark" aria-label="Casher">casher</Link>}
        <div className="flex items-center gap-2">
          {onImport ? <Button variant="ghost" className="header-action" aria-label="Upload statement" onClick={onImport} disabled={importing}><NavigationIcon source={plus} /></Button> : <Button variant="ghost" className="header-action" aria-label="Upload statement" asChild><Link to="/dashboard?import=1"><NavigationIcon source={plus} /></Link></Button>}
          <Button variant="ghost" className="header-action" aria-label="Account" asChild><Link to="/account"><NavigationIcon source={person} /></Link></Button>
        </div>
      </div>
    </header>
    <main id="main-content" className="app-content">
      {offline && <div role="status" className="mb-6 flex gap-3 rounded-xl bg-card p-4 text-sm"><WifiOff className="h-5 w-5 shrink-0" aria-hidden="true" /><p>You’re offline. Any figures still visible were loaded earlier. Reconnect to refresh, import or save changes.</p></div>}
      {children}
    </main>
    <nav className="app-tab-dock" aria-label="Main navigation"><div className="app-tab-bar">
      {destinations.map(item => {
        const selected = item.path === '/dashboard' ? pathname === item.path || pathname.includes('/insights') || pathname.includes('/history') : pathname === item.path;
        return <Link key={item.path} to={item.path} className="app-tab" aria-current={selected ? 'page' : undefined}><NavigationIcon source={item.icon} /><span>{item.label}</span></Link>;
      })}
    </div></nav>
  </div>;
}
