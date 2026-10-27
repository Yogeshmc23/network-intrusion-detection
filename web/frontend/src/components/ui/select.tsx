import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, label, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {label && (
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'flex h-10 w-full appearance-none rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 py-2 pr-10 text-sm text-slate-100 placeholder:text-slate-500 backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
              error && 'border-red-500 focus-visible:ring-red-500',
              className
            )}
            {...props}
          >
            {children}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Select };
