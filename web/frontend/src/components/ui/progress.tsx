import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  variant?: 'safe' | 'danger' | 'accent' | 'default';
  indicatorClassName?: string;
  indeterminate?: boolean;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, variant = 'default', indicatorClassName, indeterminate = false, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    const variantClasses = {
      default: 'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]',
      safe: 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.5)]',
      danger: 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]',
      accent: 'bg-cyan-600 shadow-[0_0_10px_rgba(6,182,212,0.3)]',
    }[variant];

    return (
      <div
        ref={ref}
        className={cn(
          'relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800/80 border border-white/5',
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'h-full w-full flex-1 rounded-full',
            indeterminate ? 'progress-indeterminate' : 'transition-all duration-300 ease-out',
            variantClasses,
            indicatorClassName
          )}
          style={indeterminate ? undefined : { transform: `translateX(-${100 - percentage}%)` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';

export { Progress };
