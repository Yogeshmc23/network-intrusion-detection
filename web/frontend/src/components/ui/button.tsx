import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40',
        destructive:
          'bg-red-500 text-white hover:bg-red-600 font-semibold shadow-lg shadow-red-500/20 hover:shadow-red-500/40',
        outline:
          'border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white hover:border-slate-600 backdrop-blur-sm',
        secondary:
          'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700/60',
        ghost:
          'hover:bg-slate-800/70 text-slate-300 hover:text-white',
        link:
          'text-cyan-400 underline-offset-4 hover:underline p-0 h-auto',
        cyber:
          'bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-400 text-slate-950 font-semibold hover:opacity-95 shadow-lg shadow-cyan-500/25',
        purple:
          'bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-600/20',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-8 text-base font-medium',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
