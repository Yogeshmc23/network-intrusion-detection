import * as React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2, Shield } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

function SessionLoadingScreen({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 text-slate-300">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 via-cyan-500 to-purple-600 shadow-lg shadow-cyan-500/30">
        <Shield className="h-7 w-7 text-slate-950" />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
        <span>{label}</span>
      </div>
    </div>
  );
}

function useAuthStatus() {
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return { isInitialized, isAuthenticated };
}

/**
 * Blocks protected pages until the persisted session has been validated.
 * While validation runs we render a loading screen instead of redirecting, so a
 * page reload with a valid session never flashes the login page (or logs out).
 */
export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { isInitialized, isAuthenticated } = useAuthStatus();
  const location = useLocation();

  if (!isInitialized) {
    return <SessionLoadingScreen label="Restoring your secure session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}

/** Keeps authenticated users away from /login and /signup. */
export function PublicOnlyRoute({ children }: { children?: React.ReactNode }) {
  const { isInitialized, isAuthenticated } = useAuthStatus();

  if (!isInitialized) {
    return <SessionLoadingScreen label="Checking your session…" />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
