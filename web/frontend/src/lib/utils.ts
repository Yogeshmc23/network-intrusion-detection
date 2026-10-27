import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercent(value: number | undefined | null, decimals: number = 2): string {
  if (value === undefined || value === null || isNaN(value)) return '0.00%';
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatMetric(value: number | undefined | null, decimals: number = 4): string {
  if (value === undefined || value === null || isNaN(value)) return '0.0000';
  return Number(value).toFixed(decimals);
}
