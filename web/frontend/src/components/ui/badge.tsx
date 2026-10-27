import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
        secondary:
          'border-transparent bg-slate-800 text-slate-300 border border-slate-700',
        destructive:
          'border-transparent bg-red-500/20 text-red-300 border border-red-500/30',
        outline:
          'text-slate-300 border border-slate-700',
        safe:
          'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]',
        danger:
          'bg-red-500/15 text-red-300 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]',
        warning:
          'bg-amber-500/15 text-amber-300 border border-amber-500/30',
        purple:
          'bg-purple-500/15 text-purple-300 border border-purple-500/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'mr-1.5 h-1.5 w-1.5 rounded-full',
            variant === 'safe'
              ? 'bg-cyan-400 animate-pulse'
              : variant === 'danger' || variant === 'destructive'
              ? 'bg-red-400 animate-ping'
              : 'bg-current'
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
