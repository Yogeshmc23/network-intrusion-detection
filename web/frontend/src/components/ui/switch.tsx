import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, label, disabled, ...props }, ref) => {
    return (
      <div className="inline-flex items-center gap-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          ref={ref}
          disabled={disabled}
          onClick={() => onCheckedChange?.(!checked)}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            checked ? 'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]' : 'bg-slate-800',
            className
          )}
          {...props}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
              checked ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
        {label && <span className="text-sm text-slate-300 font-medium select-none">{label}</span>}
      </div>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };
