'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'
import { formatRelativeTime } from '@/lib/utils/format'
import { STATUS_VARIANT, type StatusKey } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/States'

/**
 * Timeline (playbook S074, contract v2/details components-patterns.md §7).
 *
 * One append-only, newest-first log for every history surface: job logs, CRM
 * contact history, enquiry status, dispute case notes, admin audit tails. It is
 * shared precisely so those surfaces stop each rolling their own — a job log
 * that colours "completed" differently from the admin audit is a reader having
 * to relearn the colours per screen.
 *
 * The dot colour is therefore NOT a free choice: it resolves through the same
 * `STATUS_VARIANT` map the Badge uses, so emerald means "done or verified" on a
 * timeline exactly as it does on a badge. A status the platform does not colour
 * — or none at all — gets a neutral muted dot rather than an invented one.
 *
 * The rail is built from flexbox, not absolute positioning: each row's dot is
 * followed by a hairline that grows to fill the row height, so rows of any
 * content length stay connected with no measuring and no magic offsets.
 */

type BadgeVariant = (typeof STATUS_VARIANT)[StatusKey]

/**
 * Badge variant → the dot's fill token. Same law as the Badge colours. Keyed by
 * only the variants `STATUS_VARIANT` actually resolves to — the qualifier
 * variants (verified/student/registered) never come from a status string.
 */
const DOT_COLOUR: Record<BadgeVariant, string> = {
  pending: 'bg-warning',
  active: 'bg-accent',
  complete: 'bg-success',
  stopped: 'bg-destructive',
  neutral: 'bg-muted',
}

function dotColour(status?: StatusKey): string {
  if (!status) return 'bg-muted'
  return DOT_COLOUR[STATUS_VARIANT[status]] ?? 'bg-muted'
}

export type TimelineEvent = {
  id: string
  /** Machine kind (e.g. 'status_change', 'note') — carried for the data model. */
  kind: string
  label: string
  /** Optional secondary line under the label. */
  detail?: string
  /** ISO timestamp — used verbatim for the <time datetime> attribute. */
  timestamp: string
  /** Drives the dot colour through the canonical status law. */
  status?: StatusKey
}

export type TimelineProps = {
  events: TimelineEvent[]
  /** Tightens vertical rhythm for dense surfaces (audit tails, notes). */
  compact?: boolean
  loadMore?: { hasMore: boolean; onLoadMore: () => void }
  className?: string
}

export const Timeline = React.forwardRef<HTMLDivElement, TimelineProps>(function Timeline(
  { events, compact, loadMore, className },
  ref
) {
  // Empty is owned by the mounting surface — a job log and an audit tail want
  // different "nothing yet" copy, and the lexicon linter bans a generic one here.
  if (events.length === 0) return null

  const rowPad = compact ? 'pb-4' : 'pb-6'

  return (
    <div ref={ref} className={className}>
      {/* The order IS the information — a screen reader should hear it as a
          numbered sequence, newest first. */}
      <ol className="flex flex-col">
        {events.map((event, index) => {
          const isLast = index === events.length - 1

          return (
            <li key={event.id} className="flex gap-3">
              {/* Marker rail: the dot, then a hairline that fills the remaining
                  row height to reach the next dot. Decorative — the status is
                  conveyed in the label, not the colour alone. */}
              <div className="flex flex-col items-center" aria-hidden="true">
                <span
                  className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', dotColour(event.status))}
                />
                {!isLast && <span className="bg-border mt-1 w-px flex-1" />}
              </div>

              <div className={cn('flex-1', !isLast && rowPad)}>
                <p className="text-foreground text-sm">{event.label}</p>
                {event.detail && <p className="text-muted mt-0.5 text-sm">{event.detail}</p>}
                <time
                  dateTime={event.timestamp}
                  // Relative time is computed against "now", so server and client
                  // can land a second apart at a bucket boundary; suppress that
                  // one benign mismatch rather than freeze the timestamp.
                  suppressHydrationWarning
                  className="text-muted mt-1 block font-mono text-xs tabular-nums"
                >
                  {formatRelativeTime(event.timestamp)}
                </time>
              </div>
            </li>
          )
        })}
      </ol>

      {loadMore?.hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" size="sm" onClick={loadMore.onLoadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
})

/**
 * Loading state for a Timeline: a few rows of the same rail-plus-text geometry,
 * so the swap to real events does not shift the surface.
 */
export function TimelineSkeleton({
  rows = 3,
  compact,
  className,
}: {
  rows?: number
  compact?: boolean
  className?: string
}) {
  const rowPad = compact ? 'pb-4' : 'pb-6'

  return (
    <div className={className} aria-hidden="true">
      <div className="flex flex-col">
        {Array.from({ length: rows }, (_, index) => {
          const isLast = index === rows - 1
          return (
            <div key={index} className="flex gap-3">
              <div className="flex flex-col items-center">
                <Skeleton className="mt-1.5 size-2.5 shrink-0 rounded-full" />
                {!isLast && <span className="bg-border mt-1 w-px flex-1" />}
              </div>
              <div className={cn('flex-1', !isLast && rowPad)}>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-1 h-3 w-24" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
