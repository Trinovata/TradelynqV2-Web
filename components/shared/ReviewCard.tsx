'use client'

import * as React from 'react'
import { Flag, MoreVertical, Star } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { motion } from '@/lib/motion'
import { cardVariants } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StarRating } from '@/components/ui/StarRating'

/**
 * ReviewCard + DistributionBar (playbook S074, contract v2/details components-patterns.md §3).
 *
 * Grouped in one file because they are one surface: a storefront's reviews block
 * is the DistributionBar as its header and a column of ReviewCards beneath.
 *
 * Two rules the review system encodes and this component must never break:
 *
 *   1. **Names are already masked.** `reviewerLabel` arrives from
 *      `formatReviewerName` as "Nia R." — reviews are public and permanent, and
 *      a full name on a public opinion in a country this small is an
 *      identification. This component NEVER receives or renders a raw name, so
 *      it renders `reviewerLabel` verbatim and does no masking of its own.
 *
 *   2. **A rating only exists from the third approved review (D40).** So
 *      DistributionBar takes `average: number | null` and, when null, shows a
 *      "New on TradeLynq" headline in place of a numeral — never a provisional
 *      0.0 or a one-review average that a competitor could weaponise.
 */

// ── ReviewCard ────────────────────────────────────────────────────────────────

export type ReviewCardProps = {
  review: {
    /** Pre-masked by formatReviewerName — never a raw name. */
    reviewerLabel: string
    /** Display-ready date string; rendered in mono. */
    date: string
    stars: 1 | 2 | 3 | 4 | 5
    testimonial: string
    /** Enquiry-linked: earns the "Verified job" success chip. */
    verifiedJob: boolean
    /** Provided at onboarding and vetted: earns the slate provenance chip. */
    seeded: boolean
  }
  /** Only the professional's own storefront view passes these — the flag menu. */
  flaggable?: boolean
  onFlag?: () => void
  className?: string
}

/** Lines shown before "Read more" appears. Matches the §3 contract. */
const CLAMP_LINES = 4

export const ReviewCard = React.forwardRef<HTMLElement, ReviewCardProps>(function ReviewCard(
  { review, flaggable = false, onFlag, className },
  ref
) {
  const { reviewerLabel, date, stars, testimonial, verifiedJob, seeded } = review

  const [expanded, setExpanded] = React.useState(false)
  // Until we have measured, assume the text overflows so the collapsed clamp is
  // the first paint. That way long testimonials never flash their full height
  // before snapping back to four lines.
  const [overflows, setOverflows] = React.useState(true)
  const testimonialRef = React.useRef<HTMLParagraphElement>(null)

  // Measure whether the testimonial actually exceeds four lines. If it fits, we
  // drop the clamp and the toggle entirely — a two-line review should not carry
  // a "Read more" that reveals nothing.
  React.useEffect(() => {
    const element = testimonialRef.current
    if (!element) return

    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight)
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) return
      // +1px tolerance: sub-pixel rounding must not force a phantom toggle.
      setOverflows(element.scrollHeight > lineHeight * CLAMP_LINES + 1)
    }

    measure()
    // Re-measure on width changes — a reflow can turn three lines into five.
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [testimonial])

  const showToggle = overflows
  const isCollapsed = showToggle && !expanded

  return (
    <article
      ref={ref}
      className={cn(
        cardVariants({ elevation: 'flat', padding: 'default' }),
        'flex flex-col gap-3',
        className
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <StarRating value={stars} size={16} />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-foreground text-sm font-medium">{reviewerLabel}</span>
            <span className="text-muted font-mono text-xs tabular-nums">{date}</span>
          </div>
        </div>

        {flaggable && <FlagMenu onFlag={onFlag} />}
      </header>

      {/*
       * The testimonial in an M12 grid-rows accordion.
       *
       * The full text lives once in `<p>` and is the single copy assistive tech
       * reads — even collapsed, a screen-reader user gets the whole review. The
       * grid wraps it: collapsed clips it to the clamp height, expanded animates
       * to its natural height by transitioning grid-template-rows (M12), which
       * composites rather than running layout on the paragraph itself.
       */}
      <div
        className={cn('grid', motion('accordion'))}
        style={{ gridTemplateRows: isCollapsed ? undefined : '1fr' }}
      >
        <div className={cn('min-h-0', isCollapsed && 'overflow-hidden')}>
          <p
            ref={testimonialRef}
            className={cn('text-body text-sm', isCollapsed && 'line-clamp-4')}
          >
            {testimonial}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {verifiedJob && <Badge variant="complete">Verified job</Badge>}
          {seeded && <Badge variant="neutral">Provided at onboarding · verified</Badge>}
        </div>

        {showToggle && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className={cn(
              'text-accent-ink shrink-0 text-sm font-medium underline-offset-4 hover:underline',
              'focus-visible:outline-ring rounded-[--radius-tag] focus-visible:outline-2 focus-visible:outline-offset-2'
            )}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>
    </article>
  )
})

/**
 * The overflow "more" menu holding the Flag action.
 *
 * Reporting a review is a rare, deliberate act, so it hides behind a menu rather
 * than sitting on the card as a permanent affordance. The button is a 44px hit
 * area around a 16px glyph; the menu closes on Escape, on outside click, and
 * after the action fires.
 */
function FlagMenu({ onFlag }: { onFlag?: () => void }) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Review options"
        className={cn(
          'text-muted -m-2 grid size-11 place-items-center rounded-[--radius-control]',
          'transition-transform duration-75 ease-out active:scale-[0.98]',
          'hover:text-foreground focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
          '[&_svg]:size-4'
        )}
      >
        <MoreVertical aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'bg-card border-border absolute right-0 z-20 mt-1 min-w-[10rem] rounded-[--radius-control] border p-1 shadow-lg',
            motion('fadeSlideIn')
          )}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onFlag?.()
            }}
            className={cn(
              'text-body flex w-full items-center gap-2 rounded-[--radius-tag] px-2 py-2 text-left text-sm',
              'hover:bg-card-subtle focus-visible:bg-card-subtle focus-visible:outline-none',
              '[&_svg]:size-4 [&_svg]:shrink-0'
            )}
          >
            <Flag aria-hidden="true" className="text-muted" />
            Flag this review
          </button>
        </div>
      )}
    </div>
  )
}

// ── DistributionBar ───────────────────────────────────────────────────────────

export type DistributionBarProps = {
  /** Count of reviews at each star level. */
  distribution: Record<'5' | '4' | '3' | '2' | '1', number>
  /** null → no rating yet (fewer than 3 approved reviews, D40). */
  average: number | null
  className?: string
}

/** 5★ down to 1★ — the order a reader scans a distribution. */
const STAR_ROWS = ['5', '4', '3', '2', '1'] as const

export const DistributionBar = React.forwardRef<HTMLDivElement, DistributionBarProps>(
  function DistributionBar({ distribution, average, className }, ref) {
    const total = STAR_ROWS.reduce((sum, key) => sum + (distribution[key] || 0), 0)

    return (
      <div
        ref={ref}
        className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6', className)}
      >
        {/* The headline: the average, or the D40 "new" state in its place. */}
        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-center">
          {average === null ? (
            <span className="text-foreground max-w-[8rem] text-base leading-tight font-medium sm:text-center">
              New on TradeLynq
            </span>
          ) : (
            <>
              <span className="text-foreground font-mono text-4xl leading-none tabular-nums">
                {average.toFixed(1)}
              </span>
              <StarRating value={average} size={16} />
            </>
          )}
          <span className="text-muted font-mono text-xs tabular-nums">
            {total} {total === 1 ? 'review' : 'reviews'}
          </span>
        </div>

        {/*
         * The five bars are ONE described list, not five progressbars. A screen
         * reader should hear "5 stars: 12 reviews" five times, not five separate
         * progress announcements — so each row carries its own aria-label and the
         * fill bars themselves are aria-hidden decoration.
         */}
        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
          {STAR_ROWS.map((key) => {
            const count = distribution[key] || 0
            const fraction = total > 0 ? count / total : 0

            return (
              <li
                key={key}
                aria-label={`${key} ${key === '1' ? 'star' : 'stars'}: ${count} ${count === 1 ? 'review' : 'reviews'}`}
                className="flex items-center gap-2"
              >
                <span
                  aria-hidden="true"
                  className="text-muted flex w-6 shrink-0 items-center gap-0.5 font-mono text-xs tabular-nums"
                >
                  {key}
                  <Star className="text-warning size-3 fill-current" />
                </span>
                <span
                  aria-hidden="true"
                  className="bg-border h-1.5 min-w-0 flex-1 overflow-hidden rounded-full"
                >
                  <span
                    className={cn('bg-accent block h-full w-full', motion('progressFill'))}
                    style={{ transform: `scaleX(${fraction})` }}
                  />
                </span>
                <span
                  aria-hidden="true"
                  className="text-muted w-6 shrink-0 text-right font-mono text-xs tabular-nums"
                >
                  {count}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }
)
