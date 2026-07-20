'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'

/**
 * Pagination and InfiniteList (playbook S071/S072, contract v2/details §20).
 *
 * Two components because the two audiences want opposite things. A customer
 * browsing professionals wants the list to keep going; an admin reconciling
 * payments wants to be on page 7 and to be able to return to page 7 tomorrow.
 * Infinite scroll destroys that addressability, so admin surfaces get numbers.
 *
 * **The rule that must not be relaxed on `InfiniteList`: the "Load more" button
 * is not a fallback, it is the primary control.** An IntersectionObserver-only
 * list is unreachable by keyboard — there is nothing to Tab to — and a screen
 * reader user has no way to discover that more content exists at all. The
 * observer is a convenience layered on top of a working button, never a
 * replacement for one. Deleting the button to "clean up the design" silently
 * removes the rest of the list for anyone not using a mouse.
 */

export type InfiniteListProps = {
  onLoadMore: () => void
  loading: boolean
  hasMore: boolean
  children: React.ReactNode
  /** Announced when everything has loaded. Written per surface. */
  endMessage?: string
  /** Label on the manual control. Name the thing: "Load more professionals". */
  loadMoreLabel?: string
  className?: string
}

export function InfiniteList({
  onLoadMore,
  loading,
  hasMore,
  children,
  endMessage,
  loadMoreLabel = 'Load more',
  className,
}: InfiniteListProps) {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  // Held in a ref so the observer is created once, not torn down and rebuilt on
  // every render where `loading` flips. Rebuilding it mid-scroll drops the
  // intersection event and the list stalls until the user scrolls again.
  //
  // Written in an effect rather than during render: mutating a ref while
  // rendering is not safe under concurrent rendering, where a render can be
  // discarded and replayed. The effect has no dependency array on purpose — it
  // must run after every commit so the observer always reads current values,
  // and observer callbacks only ever fire after a commit, never mid-render.
  const stateRef = React.useRef({ onLoadMore, loading, hasMore })
  React.useEffect(() => {
    stateRef.current = { onLoadMore, loading, hasMore }
  })

  React.useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) return
        const { loading: isLoading, hasMore: more, onLoadMore: load } = stateRef.current
        if (isLoading || !more) return
        load()
      },
      // Fires a screen before the end so the next page is usually already
      // rendered by the time the user reaches it.
      { rootMargin: '600px 0px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={cn('flex flex-col', className)}>
      {children}

      {/* Not the button's wrapper — an empty zero-height div, so the observer
          fires on scroll position rather than on the button becoming visible. */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      <div
        className="flex min-h-11 items-center justify-center py-4"
        aria-live="polite"
        aria-busy={loading}
      >
        {hasMore ? (
          <Button
            variant="secondary"
            onClick={onLoadMore}
            disabled={loading}
            isLoading={loading}
            loadingLabel="Loading more…"
          >
            {loadMoreLabel}
          </Button>
        ) : (
          endMessage && <p className="text-muted text-sm">{endMessage}</p>
        )}
      </div>
    </div>
  )
}

export type PaginationProps = {
  /** One-based, matching what the user sees. */
  page: number
  /** Total number of pages, not total rows. */
  total: number
  onChange: (page: number) => void
  className?: string
}

/**
 * Builds the visible page list: always first and last, the current page and one
 * neighbour either side, and gaps elsewhere. Nine slots maximum, so the control
 * never wraps on a 375px screen.
 */
function pageItems(page: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const items: Array<number | 'gap'> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(total - 1, page + 1)

  if (start > 2) items.push('gap')
  for (let n = start; n <= end; n += 1) items.push(n)
  if (end < total - 1) items.push('gap')

  items.push(total)
  return items
}

export function Pagination({ page, total, onChange, className }: PaginationProps) {
  if (total <= 1) return null

  const items = pageItems(page, total)

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex items-center justify-center gap-1', className)}
    >
      <Button
        variant="ghost"
        size="sm"
        className="min-h-11 min-w-11"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft aria-hidden="true" />
      </Button>

      {items.map((item, index) =>
        item === 'gap' ? (
          <span
            // Gaps have no identity of their own, so the index is the only key
            // available — and they never reorder relative to each other.
            key={`gap-${index}`}
            aria-hidden="true"
            className="text-muted min-w-11 text-center font-mono text-sm tabular-nums"
          >
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={item === page ? 'primary' : 'ghost'}
            size="sm"
            className="min-h-11 min-w-11 font-mono tabular-nums"
            onClick={() => onChange(item)}
            // aria-current is how a screen reader knows which page it is on;
            // the accent fill alone communicates nothing to it.
            aria-current={item === page ? 'page' : undefined}
            aria-label={`Page ${item}`}
          >
            {item}
          </Button>
        )
      )}

      <Button
        variant="ghost"
        size="sm"
        className="min-h-11 min-w-11"
        onClick={() => onChange(page + 1)}
        disabled={page >= total}
        aria-label="Next page"
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  )
}
