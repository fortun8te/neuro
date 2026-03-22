import { clsx, type ClassValue } from 'clsx';

/** Merge class names — uses clsx (available via class-variance-authority) */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
