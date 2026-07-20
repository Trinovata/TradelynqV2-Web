'use client'

import * as React from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * StarRating (playbook S070, contract v2/details §18).
 *
 * Two modes that share almost nothing but their look.
 *
 * **Display** is not interactive and is not focusable. It renders the exact
 * average — 4.8 draws four full stars and one four-fifths full, because
 * rounding 4.8 up to five stars is a small lie about a professional's record,
 * and rounding down is a small lie in the other direction. The numeral beside
 * it is the precise figure; the stars are the shape of it.
 *
 * **Interactive** is a radio group, not five buttons. A rating is one choice
 * out of five, which is exactly what a radio group is, and getting that right
 * is what gives keyboard users arrow keys for free semantically. The hit areas
 * are 44px even when the star is 16px — the star is the label, not the target.
 *
 * Numerals are mono with tabular figures throughout: a rating that changes from
 * 4.9 to 5.0 must not shift the count beside it.
 */

export type StarRatingProps = {
  /** 0–5. Fractional values render as partial fill in display mode. */
  value: number
  /** Number of reviews. Rendered as "(23)". */
  count?: number
  size?: 16 | 20
  interactive?: boolean
  onChange?: (value: 1 | 2 | 3 | 4 | 5) => void
  /** Accessible name for the group. Only used when interactive. */
  label?: string
  className?: string
}

const STARS = [1, 2, 3, 4, 5] as const
type StarValue = (typeof STARS)[number]

function clampToStar(value: number): StarValue {
  const rounded = Math.min(5, Math.max(1, Math.round(value)))
  return rounded as StarValue
}

/**
 * One star drawn twice: a track star in `--border`, and a filled star in
 * `--warning` clipped to the fraction. Clipping a static overlay costs nothing
 * — nothing here animates, so there is no layout-thrash concern.
 */
function StarGlyph({ fraction, size }: { fraction: number; size: number }) {
  return (
    <span
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Star className="text-border absolute inset-0 size-full fill-current" />
      {fraction > 0 && (
        <span
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${Math.min(1, fraction) * 100}%` }}
        >
          <Star
            className="text-warning absolute inset-y-0 left-0 fill-current"
            style={{ width: size, height: size }}
          />
        </span>
      )}
    </span>
  )
}

export function StarRating({
  value,
  count,
  size = 16,
  interactive = false,
  onChange,
  label = 'Rating',
  className,
}: StarRatingProps) {
  const buttonRefs = React.useRef(new Map<StarValue, HTMLButtonElement>())

  if (interactive) {
    const selected = value >= 1 ? clampToStar(value) : null

    const commit = (next: StarValue) => {
      onChange?.(next)
      // Focus follows selection, matching native radio behaviour: after an
      // arrow key the focused control and the checked control must be the same
      // one, or the next arrow press moves from the wrong place.
      buttonRefs.current.get(next)?.focus()
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
      const current = selected ?? 1
      let next: StarValue | null = null

      // Right/Up increase, Left/Down decrease — the native radio-group model,
      // and the one that matches the visual order in a left-to-right locale.
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        next = clampToStar(current + 1)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        next = clampToStar(current - 1)
      } else if (event.key === 'Home') {
        next = 1
      } else if (event.key === 'End') {
        next = 5
      }

      if (next === null) return
      event.preventDefault()
      commit(next)
    }

    return (
      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className={cn('inline-flex items-center', className)}
      >
        {STARS.map((star) => {
          const checked = selected === star
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
              // Roving tabindex: the group is one tab stop. With nothing
              // chosen yet, the first star is the entry point.
              tabIndex={checked || (selected === null && star === 1) ? 0 : -1}
              ref={(node) => {
                if (node) buttonRefs.current.set(star, node)
                else buttonRefs.current.delete(star)
              }}
              onClick={() => commit(star)}
              className={cn(
                // 44px target around a 16 or 20px glyph.
                'grid size-11 place-items-center rounded-[--radius-control]',
                'transition-transform duration-75 ease-out active:scale-[0.98]',
                'focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2'
              )}
            >
              <StarGlyph fraction={selected !== null && star <= selected ? 1 : 0} size={size} />
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="inline-flex items-center gap-0.5">
        {STARS.map((star) => (
          <StarGlyph key={star} fraction={value - (star - 1)} size={size} />
        ))}
      </span>

      {/* One accessible sentence rather than five star images plus loose
          numerals, which is what a reader would otherwise announce. */}
      <span className="sr-only">
        {value.toFixed(1)} out of 5
        {count !== undefined && `, ${count} ${count === 1 ? 'review' : 'reviews'}`}
      </span>

      <span aria-hidden="true" className="text-foreground font-mono text-sm tabular-nums">
        {value.toFixed(1)}
      </span>

      {count !== undefined && (
        <span aria-hidden="true" className="text-muted font-mono text-sm tabular-nums">
          ({count})
        </span>
      )}
    </span>
  )
}
