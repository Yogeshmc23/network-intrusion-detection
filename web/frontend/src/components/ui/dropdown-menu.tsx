import * as React from 'react';
import { cn } from '@/lib/utils';

interface DropdownContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const DropdownContext = React.createContext<DropdownContextValue | undefined>(undefined);

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

function DropdownMenuTrigger({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = React.useContext(DropdownContext);
  if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu');

  return (
    <button
      type="button"
      className={cn('inline-flex items-center justify-center focus:outline-none', className)}
      onClick={() => context.setOpen((prev) => !prev)}
      {...props}
    >
      {children}
    </button>
  );
}

function DropdownMenuContent({
  className,
  align = 'end',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { align?: 'start' | 'end' | 'center' }) {
  const context = React.useContext(DropdownContext);
  if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu');

  if (!context.open) return null;

  const alignClass = {
    start: 'left-0',
    end: 'right-0',
    center: 'left-1/2 -translate-x-1/2',
  }[align];

  return (
    <div
      className={cn(
        'absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 p-1.5 text-slate-200 shadow-xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95',
        alignClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function DropdownMenuItem({
  className,
  children,
  onClick,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const context = React.useContext(DropdownContext);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onClick?.(e);
    context?.setOpen(false);
  };

  return (
    <div
      role="menuitem"
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-lg px-2.5 py-2 text-xs md:text-sm outline-none transition-colors hover:bg-slate-800 hover:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-slate-300 gap-2',
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </div>
  );
}

function DropdownMenuLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-2.5 py-1.5 text-xs font-semibold text-slate-400', className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('-mx-1 my-1 h-px bg-white/10', className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};
