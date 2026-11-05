import * as React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

export function MainLayout() {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const location = useLocation();
  const menuButton = React.useRef<HTMLButtonElement>(null);
  const closeMenu = React.useCallback(() => {
    setMobileOpen(false);
    window.setTimeout(() => menuButton.current?.focus(), 0);
  }, []);

  React.useEffect(() => {
    if (!mobileOpen) return;
    const drawer = document.querySelector<HTMLElement>('.mobile-sidebar-drawer');
    drawer?.querySelector<HTMLElement>('a, button')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { closeMenu(); return; }
      if (event.key !== 'Tab' || !drawer) return;
      const items = Array.from(drawer.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)'));
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; };
  }, [mobileOpen, closeMenu]);
  React.useEffect(() => { if (mobileOpen) closeMenu(); }, [location.pathname]);

  return (
    <div className="app-shell min-h-screen bg-background text-foreground flex flex-col antialiased">
      <div className="hidden lg:block"><Sidebar collapsed={collapsed} setCollapsed={setCollapsed} /></div>
      {mobileOpen && <button aria-label="Close navigation menu" className="mobile-sidebar-backdrop lg:hidden" onClick={closeMenu} />}
      <div className={cn('mobile-sidebar-drawer lg:hidden', mobileOpen ? 'mobile-sidebar-open' : '')} aria-hidden={!mobileOpen}>
        <Sidebar collapsed={false} setCollapsed={closeMenu} onNavigate={closeMenu} />
      </div>
      <div className={cn('flex-1 flex flex-col transition-[margin] duration-200', collapsed ? 'lg:ml-20' : 'lg:ml-72')}>
        <Header onToggleMobileSidebar={() => setMobileOpen((open) => !open)} menuButtonRef={menuButton} mobileOpen={mobileOpen} />
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 md:p-7 max-w-[1600px] w-full mx-auto">
          <AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}><Outlet /></motion.div></AnimatePresence>
        </main>
        <footer className="app-footer"><span>CyberShield IDS · NSL-KDD research/demo platform</span><span>Evaluation figures are offline benchmarks, not live detection rates.</span></footer>
      </div>
    </div>
  );
}
