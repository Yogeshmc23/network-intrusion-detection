import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authApi, modelsApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import { useModelStore } from '@/stores/modelStore';
import { Sun, Moon, ShieldCheck, LogOut, Menu } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

interface HeaderProps { onToggleMobileSidebar: () => void; menuButtonRef: React.RefObject<HTMLButtonElement>; mobileOpen: boolean }
const pageInfo: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Threat Operations', subtitle: 'Account activity and model evaluation' },
  '/predict': { title: 'Prediction', subtitle: 'Classify NSL-KDD network connection records' },
  '/models': { title: 'Model comparison', subtitle: 'Offline evaluation on holdout and external data' },
  '/live': { title: 'Live monitor', subtitle: 'No network event source is configured' },
  '/history': { title: 'Prediction history', subtitle: 'Saved inferences for your account' },
  '/features': { title: 'Feature importance', subtitle: 'Model-provided feature ranking' },
  '/help': { title: 'Help & reference', subtitle: 'Project documentation and FAQ' },
};

export function Header({ onToggleMobileSidebar, menuButtonRef, mobileOpen }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, refreshToken } = useAuthStore();
  const { toast } = useToast();
  const { theme, toggleTheme } = useModelStore();
  const metadata = useQuery({ queryKey: ['modelMetadata'], queryFn: modelsApi.getMetadata, staleTime: 300000 });
  const activeThreshold = metadata.data?.threshold;
  const page = pageInfo[location.pathname] || pageInfo['/dashboard'];
  return <header className="app-header">
    <div className="header-title-group">
      <button ref={menuButtonRef} type="button" onClick={onToggleMobileSidebar} className="mobile-menu-trigger" aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileOpen}><Menu size={19} /></button>
      <div><h1>{page.title}</h1><p>{page.subtitle}</p></div>
    </div>
    <div className="header-actions">
      <div className="model-threshold"><ShieldCheck size={16} /><span>Decision threshold</span><strong>{activeThreshold == null ? '—' : activeThreshold.toFixed(2)}</strong></div>
      <button type="button" onClick={toggleTheme} className="icon-button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
      <DropdownMenu>
        <DropdownMenuTrigger className="user-menu-trigger" aria-label="Open account menu"><span className="user-avatar">{user?.name ? user.name.slice(0, 2).toUpperCase() : 'CS'}</span><span className="user-name">{user?.name?.split(' ')[0] || 'Analyst'}</span></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel><div className="flex flex-col"><span className="font-semibold">{user?.name || 'Analyst'}</span><span className="text-xs font-normal text-slate-400">{user?.email || ''}</span></div></DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/help')}>Help &amp; reference</DropdownMenuItem>
          <DropdownMenuItem onClick={() => { try { window.dispatchEvent(new CustomEvent('cybershield:cookie-settings')); } catch { /* no-op */ } }}>Privacy settings</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { if (refreshToken) void authApi.logout(refreshToken).catch(() => toast({ title: 'Signed out on this device', description: 'The server could not revoke this refresh token; it remains usable until it expires.', variant: 'warning' })); logout(); navigate('/login', { replace: true }); }} className="text-red-400"><LogOut size={15} /> Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>;
}
