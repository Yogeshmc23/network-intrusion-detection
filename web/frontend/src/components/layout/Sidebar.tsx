import * as React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useModelStore } from '@/stores/modelStore';
import {
  Shield,
  LayoutDashboard,
  Cpu,
  Activity,
  History,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Server,
  Zap,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { selectedModel } = useModelStore();

  const navItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      name: 'Predict',
      path: '/predict',
      icon: ShieldAlert,
      badge: 'ML',
    },
    {
      name: 'Models',
      path: '/models',
      icon: Cpu,
      badge: '99.7%',
    },
    {
      name: 'Live Monitor',
      path: '/live',
      icon: Activity,
      badge: 'Live',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      name: 'History',
      path: '/history',
      icon: History,
      badge: undefined,
    },
    {
      name: 'Features',
      path: '/features',
      icon: BarChart3,
      badge: '41',
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 z-40 h-screen transition-all duration-300 ease-in-out border-r border-white/10 bg-slate-950/80 backdrop-blur-2xl flex flex-col justify-between',
        collapsed ? 'w-20' : 'w-72'
      )}
    >
      {/* Top Header / Logo */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between h-18 px-4 py-4 border-b border-white/5">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 via-cyan-500 to-purple-600 shadow-lg shadow-cyan-500/25">
              <Shield className="h-5 w-5 text-slate-950 font-bold" />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  CyberShield <span className="text-cyan-400 text-xs px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 font-mono">IDS</span>
                </span>
                <span className="text-[11px] text-slate-400 truncate">
                  AI Intrusion Defense
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Model status chip */}
        {!collapsed && (
          <div className="mx-3 mt-4 p-2.5 rounded-xl bg-slate-900/60 border border-white/5 flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            <div className="flex flex-col truncate text-xs">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Active Inference
              </span>
              <span className="text-slate-200 font-mono truncate font-medium">
                {selectedModel}
              </span>
            </div>
          </div>
        )}

        {/* Navigation list */}
        <nav className="mt-4 px-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group relative',
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/15 to-purple-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110',
                        isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                      )}
                    />
                    {!collapsed && (
                      <div className="flex items-center justify-between w-full">
                        <span className="truncate">{item.name}</span>
                        {item.badge && (
                          <span
                            className={cn(
                              'text-[10px] font-mono px-1.5 py-0.5 rounded-full border',
                              item.badgeColor ||
                                'bg-slate-800 text-slate-300 border-slate-700'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Profile Section */}
      <div className="p-3 border-t border-white/5 bg-slate-950/40">
        <div
          className={cn(
            'flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-slate-900/60',
            collapsed ? 'justify-center' : 'justify-between'
          )}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-600 to-purple-600 text-white font-semibold text-xs shadow-md">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'CY'}
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {user?.name || 'Security Analyst'}
                </span>
                <span className="text-[11px] text-slate-400 truncate">
                  {user?.email || 'analyst@cybershield.io'}
                </span>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
