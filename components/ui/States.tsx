import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'

/**
 * Skeleton, EmptyState, and ErrorState (playbook S069).
 *
 * The design law requires loading, empty, and error states on EVERY data
 * surface. These three exist so that requirement is cheap to satisfy — a
 * requirement that is expensive to meet gets skipped, and the surface ships with
 * a spinner and a blank div.
 *
 * The rule that matters most is in `Skeleton`: it must mirror the real content's
 * geometry. A skeleton of the wrong shape causes the layout shift it was
 * supposed to prevent, which is worse than showing nothing, because the page
 * visibly jumps at the exact moment the user starts reading it.
 */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // aria-hidden: a screen reader should hear the loading announcement from
      // the region's aria-busy, not a description of grey rectangles.
      aria-hidden="true"
      className={cn('bg-card-subtle animate-pulse rounded-[--radius-control]', className)}
      {...props}
    />
  )
}

/**
 * Skeleton matching ProfessionalCard's geometry exactly: 64px avatar, three
 * text lines at decreasing widths, one action block.
 */
export function ProfessionalCardSkeleton() {
  return (
    <div className="border-border bg-card rounded-[--radius-card] border p-4 sm:p-6">
      <div className="flex gap-4">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <Skeleton className="mt-4 h-10 w-full" />
    </div>
  )
}

/**
 * Wraps a data region so assistive tech is told it is loading, rather than
 * encountering a silently empty region.
 */
export function LoadingRegion({
  isLoading,
  label = 'Loading',
  children,
}: {
  isLoading: boolean
  label?: string
  children: React.ReactNode
}) {
  return (
    <div aria-busy={isLoading} aria-live="polite" aria-label={isLoading ? label : undefined}>
      {children}
    </div>
  )
}

export type EmptyStateProps = {
  icon?: LucideIcon
  /** One line. Says what is not here, in this surface's own words. */
  heading: string
  /** One sentence. Says what to do about it. */
  body: string
  action?: { label: string; href?: string; onClick?: () => void }
  className?: string
}

/**
 * The empty state.
 *
 * Copy is written per surface in the copy decks — "No data" is banned and the
 * lexicon linter enforces it. An empty state is often a user's first impression
 * of a feature; "No results" tells them the feature is broken, whereas "No
 * plumbers in Arima yet — try a nearby area, or let us know what you need" tells
 * them the marketplace is young and offers two ways forward.
 */
export function EmptyState({ icon: Icon, heading, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className
      )}
    >
      {Icon && <Icon className="text-muted size-6" aria-hidden="true" />}
      <h3 className="text-display-sm text-foreground">{heading}</h3>
      <p className="text-muted max-w-sm text-sm text-pretty">{body}</p>
      {action && (
        <div className="pt-1">
          {action.href ? (
            <Button asChild variant="secondary" size="sm">
              <a href={action.href}>{action.label}</a>
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export type ErrorStateProps = {
  /** What failed, in the user's terms — never a stack trace or an error code. */
  heading?: string
  body?: string
  onRetry?: () => void
  className?: string
}

/**
 * The error state.
 *
 * Always offers a way forward. An error with no action leaves the user with
 * nothing to do but leave, and most of them will.
 *
 * Deliberately says nothing about the cause: the taxonomy's `INTERNAL` is opaque
 * precisely so database errors cannot reach a screen, and this is the surface
 * that would otherwise render them.
 */
export function ErrorState({
  heading = 'That did not load',
  body = 'The connection may have dropped. Try again, and if it keeps happening let us know on WhatsApp.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className
      )}
    >
      <h3 className="text-display-sm text-foreground">{heading}</h3>
      <p className="text-muted max-w-sm text-sm text-pretty">{body}</p>
      {onRetry && (
        <div className="pt-1">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}
