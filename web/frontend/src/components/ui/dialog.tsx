import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | undefined>(undefined);

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open: controlledOpen, onOpenChange, children }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(value);
      }
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange]
  );

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

function DialogTrigger({
  children,
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error('DialogTrigger must be used within Dialog');

  return (
    <button
      type="button"
      onClick={() => context.setOpen(true)}
      {...props}
    >
      {children}
    </button>
  );
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function DialogContent({ className, children, ...props }: DialogContentProps) {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error('DialogContent must be used within Dialog');

  if (!context.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={() => context.setOpen(false)}
      />

      {/* Modal Card */}
      <div
        className={cn(
          'relative z-50 w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-200 text-slate-100',
          className
        )}
        {...props}
      >
        <button
          type="button"
          onClick={() => context.setOpen(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
        >
          <X className="h-4 w-4 text-slate-400 hover:text-white" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </div>
    </div>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-4', className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-lg font-semibold leading-none tracking-tight text-white', className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm text-slate-400 mt-1', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6', className)}
      {...props}
    />
  );
}

function DialogClose({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error('DialogClose must be used within Dialog');

  return (
    <button
      type="button"
      onClick={() => context.setOpen(false)}
      {...props}
    >
      {children}
    </button>
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
};
