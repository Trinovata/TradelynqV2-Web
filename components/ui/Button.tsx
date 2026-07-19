import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Button (playbook S061, contract v2/02 §2.5.1).
 *
 * Six variants, three sizes. Two details that are easy to get wrong and
 * expensive to notice late:
 *
 * 1. **Loading locks the width.** Swapping a label for a spinner reflows the
 *    button and shifts everything beside it, so the label stays in the DOM at
 *    zero opacity and the spinner overlays it. The button keeps its size.
 *
 * 2. **`upgrade` is the only amber button on the platform.** Amber otherwise
 *    means "pending" or "warning" (DESIGN.md §2). Using it for a normal action
 *    breaks the status-colour law, which is what makes amber readable at a glance.
 */

const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-[--radius-control] font-medium',
    // Only transform animates (M1). Never `transition: all`.
    'transition-transform duration-75 ease-out active:scale-[0.98]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    // Disabled reads as dimmed, never as a different colour — a colour shift
    // reads as a different KIND of button rather than an unavailable one.
    'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-foreground hover:bg-accent/90',
        secondary: 'bg-card text-body border border-border hover:bg-card-subtle',
        ghost: 'bg-transparent text-body hover:bg-card-subtle',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        upgrade: 'bg-warning text-foreground hover:bg-warning/90',
        link: 'bg-transparent text-accent-ink underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /**
     * Renders the child element instead of a <button>, keeping the styling.
     * Use for links that look like buttons — an <a> stays keyboard- and
     * middle-click-navigable in ways a button with an onClick never is.
     */
    asChild?: boolean
    isLoading?: boolean
    /** Announced to assistive tech while loading. Defaults to a neutral phrase. */
    loadingLabel?: string
    iconLeft?: React.ReactNode
    iconRight?: React.ReactNode
  }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    fullWidth,
    asChild = false,
    isLoading = false,
    loadingLabel = 'Working…',
    iconLeft,
    iconRight,
    disabled,
    children,
    ...props
  },
  ref
) {
  const Component = asChild ? Slot : 'button'

  // Slot forwards to a single child, so the loading overlay's extra elements
  // would break it. asChild and isLoading are mutually exclusive by design.
  if (asChild) {
    return (
      <Component
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        {...props}
      >
        {children}
      </Component>
    )
  }

  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="animate-spin" aria-hidden="true" />
          <span className="sr-only">{loadingLabel}</span>
        </span>
      )}

      {/* Kept mounted so the button cannot change width mid-action. */}
      <span
        className={cn('inline-flex items-center gap-2', isLoading && 'opacity-0')}
        aria-hidden={isLoading || undefined}
      >
        {iconLeft}
        {children}
        {iconRight}
      </span>
    </button>
  )
})

export { buttonVariants }
