import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  label?: string;
  showValue?: boolean;
  valueFormatter?: (val: number) => string;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className,
      value,
      min = 0,
      max = 100,
      step = 1,
      onChange,
      label,
      showValue = true,
      valueFormatter = (v) => `${v}`,
      ...props
    },
    ref
  ) => {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
      <div className={cn('w-full space-y-2', className)}>
        {(label || showValue) && (
          <div className="flex justify-between items-center text-xs text-slate-300">
            {label && <span className="font-medium">{label}</span>}
            {showValue && <span className="font-mono text-cyan-400 font-semibold">{valueFormatter(value)}</span>}
          </div>
        )}
        <div className="relative flex items-center">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            ref={ref}
            onChange={(e) => onChange?.(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
            style={{
              background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${percentage}%, #1e293b ${percentage}%, #1e293b 100%)`,
            }}
            {...props}
          />
        </div>
      </div>
    );
  }
);
Slider.displayName = 'Slider';

export { Slider };
