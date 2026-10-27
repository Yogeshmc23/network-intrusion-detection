import * as React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function MainLayout() {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Sidebar collapsed={false} setCollapsed={() => setMobileOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div
        className={cn(
          'flex-1 flex flex-col transition-all duration-300 ease-in-out',
          collapsed ? 'lg:ml-20' : 'lg:ml-72'
        )}
      >
        <Header onToggleMobileSidebar={() => setMobileOpen(!mobileOpen)} />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="border-t border-white/5 py-4 px-8 text-center text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>CyberShield IDS v1.0.0 • NSL-KDD Defense Intelligence Platform</span>
          <span className="font-mono text-slate-400">Target Recall: 99.5% met • 41 Network Features</span>
        </footer>
      </div>
    </div>
  );
}
