'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatNumber, formatTTD } from '@/lib/utils/format'
import { cardVariants, CardLink } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/States'
import { DURATION } from '@/lib/motion'

/**
 * StatCard (playbook S074, contract v2/details components-patterns.md §6).
 *
 * The pattern this replaces is the "rainbow KPI" dashboard: every stat in its
 * own tinted tile, so the eye reads twelve competing colours and no ranking.
 * Here the card is FLAT — the number is the emphasis, colour is spent only where
 * it carries meaning, which on a stat is the trend, not the tile.
 *
 * Two rules do the real work:
 *
 * 1. **The trend colour follows meaning, not direction.** An arrow pointing down
 *    is not automatically red — churn falling is good news. So the colour is
 *    decided by whether the movement is in the *desired* direction
 *    (`goodIsUp`), and a downward churn arrow is emerald. Colour tied to the
 *    glyph rather than the outcome would teach the reader the wrong thing at a
 *    glance, which is the one thing a KPI must not do.
 *
 * 2. **Numbers count up once per session (M8), never on every mount.** The
 *    count-up is a first-impression flourish; replayed on every navigation it
 *    reads as the page being slow to settle. A session flag keyed by the label
 *    fires it on first view only, and `prefers-reduced-motion` skips it whole.
 *    A string value never counts up — there is nothing to count.
 */

export type StatFormat = 'ttd' | 'int' | 'percent' | 'raw'

export type StatTrend = {
  delta: number
  direction: 'up' | 'down'
  /** Whether "up" is the good outcome. Default true; set false for churn, cost. */
  goodIsUp?: boolean
}

export type StatCardProps = {
  /** Sits above the value: small, uppercase, muted. */
  label: string
  /** Numbers render mono and count up; strings render as-is with no count-up. */
  value: number | string
  format?: StatFormat
  trend?: StatTrend
  /** One line of secondary context under the value. */
  hint?: string
  /** Makes the whole card a link — the admin drill-down affordance. */
  href?: string
  className?: string
}

/** Formats an animating or final numeric value for display. */
function formatValue(value: number, format: StatFormat): string {
  switch (format) {
    case 'ttd':
      return formatTTD(value)
    case 'percent':
      return `${Math.round(value)}%`
    case 'int':
      return formatNumber(Math.round(value))
    case 'raw':
      return String(value)
  }
}

export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(function StatCard(
  { label, value, format = 'raw', trend, hint, href, className },
  ref
) {
  const numeric = typeof value === 'number' ? value : null
  const finalText = numeric === null ? String(value) : formatValue(numeric, format)

  // Starts at the target so the server render and first hydration match; the
  // count-up (if any) is kicked off by the effect, after hydration, on the
  // client only.
  const [display, setDisplay] = React.useState<number>(numeric ?? 0)

  React.useEffect(() => {
    if (numeric === null) return

    const key = `tlq_statcard_seen:${label}`
    let alreadySeen = false
    try {
      alreadySeen = window.sessionStorage.getItem(key) === '1'
    } catch {
      // Private-mode storage denial: treat as unseen, animate once, move on.
    }

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // State is only ever set inside a rAF callback, never synchronously in the
    // effect body — the latter triggers the cascading-render lint and is the
    // wrong shape for driving an animation frame loop anyway.
    if (alreadySeen || reduce) {
      // Settle immediately (covers a value prop that changed after first mount).
      const id = requestAnimationFrame(() => setDisplay(numeric))
      return () => cancelAnimationFrame(id)
    }

    try {
      window.sessionStorage.setItem(key, '1')
    } catch {
      // Non-fatal — the count-up simply may repeat if storage is unavailable.
    }

    let raf = 0
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION.long)
      // Ease-out (M8's enter curve): fast out of the gate, settling gently.
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(numeric * eased)
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setDisplay(numeric)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [numeric, label])

  const trendGood = trend ? (trend.direction === 'up') === (trend.goodIsUp ?? true) : false
  const TrendArrow = trend?.direction === 'up' ? ArrowUp : ArrowDown

  return (
    <div
      ref={ref}
      className={cn(
        cardVariants({ interactive: href ? true : undefined }),
        'flex flex-col gap-1.5',
        className
      )}
    >
      <div className="text-muted text-xs font-medium tracking-wide uppercase">
        {href ? (
          // The stretched link's text is its accessible name, so the label is
          // the link — "Pending payouts, link" — and the whole card is the
          // target per the Card interactive contract.
          <CardLink href={href} className="text-muted no-underline">
            {label}
          </CardLink>
        ) : (
          label
        )}
      </div>

      <div className="text-display-md text-foreground font-mono tabular-nums">
        {numeric === null ? (
          finalText
        ) : (
          <>
            <span aria-hidden="true">{formatValue(display, format)}</span>
            {/* Assistive tech reads the settled value, never the count-up. */}
            <span className="sr-only">{finalText}</span>
          </>
        )}
      </div>

      {trend && (
        <p
          className={cn(
            'flex items-center gap-1 text-xs',
            trendGood ? 'text-success' : 'text-destructive'
          )}
        >
          <TrendArrow className="size-3.5" aria-hidden="true" />
          <span className="font-mono tabular-nums">{formatNumber(Math.abs(trend.delta))}</span>
          <span className="sr-only">
            {trend.direction === 'up' ? 'up' : 'down'}, {trendGood ? 'favourable' : 'unfavourable'}
          </span>
        </p>
      )}

      {hint && <p className="text-muted text-xs">{hint}</p>}
    </div>
  )
})

/**
 * Loading state matching StatCard's geometry: a short label line above a wider
 * value block. Same padding as the card, so the swap does not shift the grid.
 */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(cardVariants({}), 'flex flex-col gap-3', className)}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-32" />
    </div>
  )
}
