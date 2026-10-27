import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'default' | 'success' | 'destructive' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (options: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    ({ title, description, variant = 'default', duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, title, description, variant, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none p-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-300',
              t.variant === 'destructive' &&
                'border-red-500/30 bg-red-950/90 text-red-200 shadow-red-500/20',
              t.variant === 'success' &&
                'border-cyan-500/30 bg-slate-900/95 text-cyan-200 shadow-cyan-500/20',
              t.variant === 'warning' &&
                'border-amber-500/30 bg-amber-950/90 text-amber-200 shadow-amber-500/20',
              t.variant === 'info' &&
                'border-purple-500/30 bg-slate-900/95 text-purple-200 shadow-purple-500/20',
              (!t.variant || t.variant === 'default') &&
                'border-white/10 bg-slate-900/95 text-slate-100'
            )}
          >
            <div className="shrink-0 mt-0.5">
              {t.variant === 'destructive' && <AlertCircle className="h-5 w-5 text-red-400" />}
              {t.variant === 'success' && <CheckCircle2 className="h-5 w-5 text-cyan-400" />}
              {t.variant === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-400" />}
              {t.variant === 'info' && <Info className="h-5 w-5 text-purple-400" />}
              {(!t.variant || t.variant === 'default') && <Info className="h-5 w-5 text-slate-400" />}
            </div>
            <div className="flex-1 text-sm">
              <h5 className="font-semibold text-white">{t.title}</h5>
              {t.description && <p className="mt-1 text-xs opacity-80">{t.description}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
