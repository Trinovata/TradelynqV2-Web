import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Badge (playbook S065, contract v2/02 §2.5.1).
 *
 * The status-colour law lives here. Its whole value is that a colour means the
 * same thing on every surface — amber is always "waiting", emerald is always
 * "done or verified", red is always "stopped". A reader learns the mapping once.
 *
 * That is why `STATUS_VARIANT` maps statuses to variants centrally rather than
 * letting each surface choose: a per-surface choice is how "pending" ends up
 * amber on the dashboard and grey in the admin queue, and the mapping stops
 * being information.
 *
 * Badges are never interactive. A clickable badge is a button that looks like a
 * label, and users do not discover it.
 */

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-[--radius-tag] px-2 py-0.5 text-xs font-medium [&_svg]:size-3',
  {
    variants: {
      variant: {
        /** Waiting on someone. */
        pending: 'bg-warning/10 text-warning border border-warning/20',
        /** Live, accepted, in motion. */
        active: 'bg-accent-soft text-accent-ink border border-accent/20',
        /** Finished, paid, verified. */
        complete: 'bg-success/10 text-success border border-success/20',
        /** Stopped: declined, cancelled, overdue. */
        stopped: 'bg-destructive/10 text-destructive border border-destructive/20',
        /** No state worth colouring: draft, converted, archived. */
        neutral: 'bg-card-subtle text-muted border border-border',
        /** Identity confirmed. Carries a shield, not just a colour. */
        verified: 'bg-success/10 text-success border border-success/20',
        /** Student track. Outline, so it reads as a qualifier not a status. */
        student: 'bg-transparent text-warning border border-warning',
        /** Registered business. The badge that replaced V1's violet (D32). */
        registered: 'bg-card-subtle text-foreground border border-border',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
)

/**
 * The canonical status → colour mapping (DESIGN.md §2).
 *
 * Every status string the platform renders resolves through here. Adding a
 * status without adding it to this map is a compile error at the call site
 * rather than a silently grey badge.
 */
export const STATUS_VARIANT = {
  // Enquiries
  pending: 'pending',
  accepted: 'active',
  in_progress: 'active',
  completed: 'complete',
  declined: 'stopped',
  cancelled: 'stopped',

  // Listings
  draft: 'neutral',
  pending_review: 'pending',
  active: 'active',
  suspended: 'stopped',

  // Quotes and invoices
  sent: 'active',
  viewed: 'active',
  paid: 'complete',
  overdue: 'stopped',
  expired: 'stopped',
  converted: 'neutral',

  // Verification
  not_started: 'neutral',
  id_verified: 'active',
  fully_verified: 'complete',
  rejected: 'stopped',

  // Subscriptions
  trialling: 'pending',
  past_due: 'stopped',
  paused: 'neutral',
} as const satisfies Record<string, VariantProps<typeof badgeVariants>['variant']>

export type StatusKey = keyof typeof STATUS_VARIANT

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    /** Resolves the variant through the canonical mapping. Overrides `variant`. */
    status?: StatusKey
  }

export function Badge({ className, variant, status, children, ...props }: BadgeProps) {
  const resolved = status ? STATUS_VARIANT[status] : variant

  return (
    <span className={cn(badgeVariants({ variant: resolved }), className)} {...props}>
      {resolved === 'verified' && <ShieldCheck aria-hidden="true" />}
      {children}
    </span>
  )
}

export { badgeVariants }
