import * as React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/auth/ProtectedRoute';
import { bootstrapSession } from '@/lib/session';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Dashboard from '@/pages/Dashboard';
import Predict from '@/pages/Predict';
import ModelComparison from '@/pages/ModelComparison';
import HelpPage from '@/components/layout/HelpPage';
import { HistoryPage, LiveMonitorPage, FeaturesPage } from '@/pages/UtilityPages';
import { GlobalTools } from '@/components/layout/GlobalTools';

export default function App() {
  // Validate any persisted session before protected routes render.
  React.useEffect(() => {
    void bootstrapSession();
    // Campaign labels remain tab-local, and are captured only after explicit
    // optional-analytics consent. They are never sent to the API.
    const captureUtmAfterConsent = (event?: Event) => {
      try {
        const eventConsent = (event as CustomEvent<{ analytics?: boolean }> | undefined)?.detail;
        const storedConsent = JSON.parse(localStorage.getItem('cybershield_cookie_consent') ?? 'null');
        const analyticsAllowed = eventConsent ? eventConsent.analytics === true : storedConsent?.analytics === true;
        if (!analyticsAllowed) {
          sessionStorage.removeItem('cybershield_utm');
          return;
        }
        const params = new URLSearchParams(window.location.search);
        const allowed = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
        const captured: Record<string, string> = {};
        for (const key of allowed) {
          const value = params.get(key)?.trim();
          if (value && value.length <= 100 && /^[A-Za-z0-9._ -]+$/.test(value)) captured[key] = value;
        }
        if (Object.keys(captured).length) sessionStorage.setItem('cybershield_utm', JSON.stringify(captured));
      } catch {
        // Storage or malformed consent must fail closed and never interrupt routing.
        try { sessionStorage.removeItem('cybershield_utm'); } catch { /* storage is optional */ }
      }
    };
    captureUtmAfterConsent();
    window.addEventListener('cybershield:consent-updated', captureUtmAfterConsent);
    return () => window.removeEventListener('cybershield:consent-updated', captureUtmAfterConsent);
  }, []);

  return (
    <>
    <GlobalTools />
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/predict" element={<Predict />} />
          <Route path="/models" element={<ModelComparison />} />
          <Route path="/live" element={<LiveMonitorPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
    </>
  );
}
