import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

/**
 * Card (playbook S066, contract v2/02 §2.5.1).
 *
 * Flat by default — border only, no shadow. Elevation has exactly three levels
 * and a resting card is the lowest; shadows on everything make nothing look
 * raised.
 *
 * An interactive card gets the whole surface as one link target rather than a
 * "View" button in the corner. A 300px card with a 60px click target is a card
 * that feels broken on a phone. The link is stretched over the card via a
 * pseudo-element so the focus ring still outlines the card, and text inside
 * stays selectable.
 */

const cardVariants = cva('rounded-[--radius-card] bg-card text-body', {
  variants: {
    elevation: {
      flat: 'border border-border',
      raised: 'border border-border shadow-sm',
      overlay: 'border border-border shadow-lg',
    },
    padding: {
      none: '',
      // 16 on mobile, 24 from tablet up — the marketplace's comfortable rhythm.
      default: 'p-4 sm:p-6',
      compact: 'p-3 sm:p-4',
    },
    interactive: {
      true: [
        'relative isolate',
        // M2: hover raise. transform and shadow only.
        'transition-[transform,box-shadow] duration-150 ease-out',
        'hover:-translate-y-0.5 hover:shadow-sm',
        // M1: press.
        'active:translate-y-0 active:scale-[0.995]',
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
      ],
    },
  },
  defaultVariants: { elevation: 'flat', padding: 'default' },
})

export type CardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof cardVariants> & {
    asChild?: boolean
  }

export function Card({ className, elevation, padding, interactive, ...props }: CardProps) {
  return (
    <div className={cn(cardVariants({ elevation, padding, interactive }), className)} {...props} />
  )
}

/**
 * Stretches a link across the entire card.
 *
 * Place inside an `interactive` Card. The pseudo-element covers the card, so the
 * whole surface is clickable while the accessible name comes from the link text
 * — screen readers announce one link, not a card full of them.
 */
export function CardLink({
  className,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(
        'after:absolute after:inset-0 after:z-10 after:content-[""]',
        'focus-visible:outline-none',
        className
      )}
      {...props}
    >
      {children}
    </a>
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-display-sm text-foreground', className)} {...props} />
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-muted text-sm', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('pt-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // Actions right-aligned, primary rightmost — the resting place of the thumb
  // on mobile and the eye on desktop.
  return <div className={cn('flex items-center justify-end gap-2 pt-4', className)} {...props} />
}

export { cardVariants }
