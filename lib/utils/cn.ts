import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges class names, resolving Tailwind conflicts in favour of the last value.
 *
 * Without `twMerge`, `cn('p-2', 'p-4')` yields both classes and the winner
 * depends on stylesheet order rather than call order — which makes component
 * variant overrides unpredictable in exactly the cases they matter.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
