import * as React from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

function Avatar({ className, size = 'md', children, ...props }: AvatarProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  }[size];

  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full border border-white/10 bg-slate-800 font-semibold text-slate-200 select-none items-center justify-center',
        sizeClasses,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}

function AvatarImage({ className, src, alt, ...props }: AvatarImageProps) {
  const [hasError, setHasError] = React.useState(false);

  if (!src || hasError) return null;

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={cn('aspect-square h-full w-full object-cover', className)}
      {...props}
    />
  );
}

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLSpanElement> {}

function AvatarFallback({ className, children, ...props }: AvatarFallbackProps) {
  return (
    <span
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr from-cyan-600 to-purple-600 text-white font-medium',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { Avatar, AvatarImage, AvatarFallback };
