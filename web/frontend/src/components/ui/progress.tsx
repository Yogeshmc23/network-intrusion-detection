import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  variant?: 'safe' | 'danger' | 'accent' | 'default';
  indicatorClassName?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, variant = 'default', indicatorClassName, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    const variantClasses = {
      default: 'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]',
      safe: 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.5)]',
      danger: 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]',
      accent: 'bg-purple-500 shadow-[0_0_12px_rgba(139,92,246,0.5)]',
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
            'h-full w-full flex-1 transition-all duration-500 ease-out rounded-full',
            variantClasses,
            indicatorClassName
          )}
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';

export { Progress };
