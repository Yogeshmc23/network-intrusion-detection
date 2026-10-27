import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useModelStore } from '@/stores/modelStore';
import {
  Bell,
  Sun,
  Moon,
  ShieldCheck,
  User,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  onToggleMobileSidebar: () => void;
}

export function Header({ onToggleMobileSidebar }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme, threshold, isOperationalMode, toggleOperationalMode } = useModelStore();

  const getPageInfo = () => {
    switch (location.pathname) {
      case '/dashboard':
        return {
          title: 'Threat Operations Dashboard',
          subtitle: 'Real-time telemetry, model metrics and threat distribution',
        };
      case '/predict':
        return {
          title: 'Inference & Anomaly Scanner',
          subtitle: 'Evaluate 41-feature network vectors via the selected IDS model',
        };
      case '/models':
        return {
          title: 'Model Benchmark & Comparison',
          subtitle: 'Decision Tree vs Naive Bayes vs SVM (RBF) — all features vs top-30 correlated',
        };
      case '/live':
        return {
          title: 'Live Network Stream Monitor',
          subtitle: 'Real-time packet inspection and instant anomaly alerting',
        };
      case '/history':
        return {
          title: 'Prediction Audit History',
          subtitle: 'Browse, filter, and export logged traffic inference records',
        };
      case '/features':
        return {
          title: 'Feature Importance & Permutation',
          subtitle: 'Inspect top feature weights and domain impact on classification',
        };
      default:
        return {
          title: 'Intrusion Detection System',
          subtitle: 'AI-driven cyber threat intelligence platform',
        };
    }
  };

  const { title, subtitle } = getPageInfo();

  return (
    <header className="sticky top-0 z-30 flex h-20 w-full items-center justify-between border-b border-white/10 bg-slate-950/70 px-4 md:px-8 backdrop-blur-xl">
      {/* Left: Mobile trigger & Titles */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
            {title}
          </h1>
          <p className="hidden md:block text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Operational Recall Status Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10">
          <ShieldCheck className="h-4 w-4 text-cyan-400" />
          <div className="flex flex-col text-[11px]">
            <span className="text-slate-400">Recall Target</span>
            <span className="font-mono text-cyan-300 font-semibold">99.5% met</span>
          </div>
          <Badge variant="safe" className="text-[10px] ml-1">
            τ={threshold.toFixed(2)}
          </Badge>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white transition-all shadow-sm"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-cyan-400" />
          )}
        </button>

        {/* Notifications Icon */}
        <div className="relative">
          <button
            className="p-2.5 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white transition-all shadow-sm relative"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-cyan-400" />
          </button>
        </div>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-800/80 transition-all">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-600 to-purple-600 text-xs font-bold text-white shadow-sm">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'CY'}
            </div>
            <span className="hidden md:inline-block text-xs font-semibold text-slate-200">
              {user?.name?.split(' ')[0] || 'Analyst'}
            </span>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-white font-semibold">{user?.name || 'Security Analyst'}</span>
                <span className="text-[11px] text-slate-400 font-normal">{user?.email || 'analyst@cybershield.io'}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/dashboard')}>
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
              <span>Security Operations</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/predict')}>
              <Settings className="h-4 w-4 text-slate-400" />
              <span>Model Config</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open('https://kdd.ics.uci.edu/databases/kddcup99/kddcup99.html', '_blank')}>
              <HelpCircle className="h-4 w-4 text-slate-400" />
              <span>NSL-KDD Dataset Docs</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
