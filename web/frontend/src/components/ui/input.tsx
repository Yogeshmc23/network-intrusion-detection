import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, ...props }, ref) => {
    if (icon) {
      return (
        <div className="relative flex items-center w-full">
          <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center justify-center">
            {icon}
          </div>
          <input
            type={type}
            className={cn(
              'flex h-10 w-full rounded-lg border border-slate-700/80 bg-slate-900/60 pl-10 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50',
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
