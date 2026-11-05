import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUp, Check, CircleHelp, Command, Cookie, Search, X } from 'lucide-react';

const destinations = [
  { title: 'Threat Operations Dashboard', detail: 'Overview and latest prediction activity', path: '/dashboard', terms: 'home stats overview' },
  { title: 'New Prediction', detail: 'Submit one network record or a CSV batch', path: '/predict', terms: 'scan inference classify anomaly csv' },
  { title: 'Model Comparison', detail: 'Compare evaluated candidates and datasets', path: '/models', terms: 'benchmark decision tree naive bayes svm metrics' },
  { title: 'Prediction History', detail: 'Review saved predictions from your account', path: '/history', terms: 'audit records past' },
  { title: 'Live Monitor', detail: 'Check whether a network event source is configured', path: '/live', terms: 'source status packet capture event ingestion live' },
  { title: 'Feature Importance', detail: 'Inspect model feature ranking', path: '/features', terms: 'importance inputs nsl-kdd' },
  { title: 'Help and FAQ', detail: 'How the IDS and its results work', path: '/help', terms: 'help faq support' },
];

function safeStorageGet(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function safeStorageSet(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* storage may be disabled */ } }

export function GlobalTools() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [preferencesOpen, setPreferencesOpen] = React.useState(false);
  const [analytics, setAnalytics] = React.useState(false);
  const [consent, setConsent] = React.useState(() => safeStorageGet('cybershield_cookie_consent'));
  const [progress, setProgress] = React.useState(0);
  const [showTop, setShowTop] = React.useState(false);
  const searchInput = React.useRef<HTMLInputElement>(null);
  const searchDialog = React.useRef<HTMLElement>(null);
  const preferencesDialog = React.useRef<HTMLElement>(null);
  const searchTrigger = React.useRef<HTMLElement | null>(null);
  const preferencesTrigger = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const update = () => {
      const root = document.documentElement;
      const range = root.scrollHeight - window.innerHeight;
      setProgress(range > 0 ? Math.min(100, Math.max(0, (window.scrollY / range) * 100)) : 0);
      setShowTop(window.scrollY > 420);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [location.pathname]);

  React.useEffect(() => {
    const openSettings = () => {
      preferencesTrigger.current = document.activeElement as HTMLElement;
      const raw = safeStorageGet('cybershield_cookie_consent');
      if (raw) { try { setAnalytics(Boolean(JSON.parse(raw).analytics)); } catch { setAnalytics(false); } }
      setPreferencesOpen(true);
    };
    window.addEventListener('cybershield:cookie-settings', openSettings);
    return () => window.removeEventListener('cybershield:cookie-settings', openSettings);
  }, []);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchTrigger.current = document.activeElement as HTMLElement;
        setSearchOpen(true);
        window.setTimeout(() => searchInput.current?.focus(), 0);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setPreferencesOpen(false);
      }
      const dialog = searchOpen ? searchDialog.current : (preferencesOpen ? preferencesDialog.current : null);
      if ((searchOpen || preferencesOpen) && event.key === 'Tab' && dialog) {
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)'));
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, preferencesOpen]);

  React.useEffect(() => {
    if (preferencesOpen) {
      preferencesDialog.current?.querySelector<HTMLElement>('button, input')?.focus();
    } else if (!searchOpen) {
      preferencesTrigger.current?.focus?.();
    }
  }, [preferencesOpen, searchOpen]);

  React.useEffect(() => {
    if (!searchOpen) searchTrigger.current?.focus?.();
  }, [searchOpen]);

  const results = destinations.filter((entry) => `${entry.title} ${entry.detail} ${entry.terms}`.toLowerCase().includes(query.trim().toLowerCase()));
  const acceptConsent = (optional: boolean) => {
    const value = JSON.stringify({ essential: true, analytics: optional, decidedAt: new Date().toISOString() });
    safeStorageSet('cybershield_cookie_consent', value);
    window.dispatchEvent(new CustomEvent('cybershield:consent-updated', { detail: { analytics: optional } }));
    setConsent(value);
    setAnalytics(optional);
    setPreferencesOpen(false);
  };
  const openSearch = () => {
    searchTrigger.current = document.activeElement as HTMLElement;
    setSearchOpen(true);
    window.setTimeout(() => searchInput.current?.focus(), 0);
  };
  const selectResult = (path: string) => {
    setSearchOpen(false);
    setQuery('');
    navigate(path);
  };

  return <>
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <div className="reading-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
    <button type="button" onClick={openSearch} className={`global-search-trigger ${!consent ? 'cookie-visible' : ''}`} aria-label="Search CyberShield pages">
      <Search size={16} /><span>Search</span><kbd><Command size={11} /> K</kbd>
    </button>

    {showTop && <button type="button" className={`back-to-top ${!consent ? 'cookie-visible' : ''}`} aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}><ArrowUp size={18} /></button>}

    <button type="button" className={`help-float ${!consent ? 'cookie-visible' : ''}`} aria-label="Open help and contact options" onClick={() => navigate('/help')}><CircleHelp size={18} /><span>Help</span></button>

    {searchOpen && <div className="tool-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}>
      <section ref={searchDialog} className="tool-dialog search-dialog" role="dialog" aria-modal="true" aria-label="Search CyberShield">
        <div className="search-field"><Search size={18} /><input ref={searchInput} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((n) => Math.min(results.length - 1, n + 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((n) => Math.max(0, n - 1)); }
          if (e.key === 'Enter' && results[active]) selectResult(results[active].path);
        }} placeholder="Search pages, features, and help…" aria-label="Search pages, features, and help" /><button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)}><X size={18} /></button></div>
        <div className="search-results" role="listbox" aria-label="Search results">
          {results.length ? results.map((item, index) => <button role="option" aria-selected={active === index} key={item.path} type="button" onMouseEnter={() => setActive(index)} onClick={() => selectResult(item.path)}><span>{item.title}<small>{item.detail}</small></span><span aria-hidden="true">↵</span></button>) : <p className="empty-search">No matches. Try “prediction”, “models”, or “help”.</p>}
        </div>
        <p className="search-hint">Use ↑ ↓ to navigate · Enter to open · Esc to close</p>
      </section>
    </div>}

    {!consent && <aside className="cookie-banner" aria-label="Cookie preferences"><div><Cookie size={18} /><div><strong>Privacy choices</strong><p>Essential storage keeps your sign-in working. Optional analytics are off and no analytics tracker is currently configured.</p></div></div><div className="cookie-actions"><button type="button" className="text-action" onClick={(event) => { preferencesTrigger.current = event.currentTarget; setAnalytics(false); setPreferencesOpen(true); }}>Cookie settings</button><button type="button" className="secondary-action" onClick={() => acceptConsent(false)}>Reject optional</button><button type="button" className="primary-action" onClick={() => acceptConsent(true)}>Accept</button></div></aside>}


    {preferencesOpen && <div className="tool-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreferencesOpen(false); }}><section ref={preferencesDialog} className="tool-dialog preferences-dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-title"><button className="dialog-close" aria-label="Close settings" type="button" onClick={() => setPreferencesOpen(false)}><X size={18} /></button><h2 id="cookie-title">Cookie settings</h2><p>Essential storage is always on for authentication and security. Optional analytics remain disabled unless you choose to allow them.</p><div className="preference-row"><span><strong>Essential</strong><small>Session and security functions</small></span><span className="always-on">Always on</span></div><label className="preference-row"><span><strong>Optional analytics</strong><small>No analytics provider is currently installed.</small></span><input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} /></label><div className="dialog-actions"><button className="secondary-action" type="button" onClick={() => acceptConsent(false)}>Reject optional</button><button className="primary-action" type="button" onClick={() => acceptConsent(analytics)}><Check size={15} /> Save choices</button></div></section></div>}
  </>;
}
