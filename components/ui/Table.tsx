'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Table (playbook S071, contract v2/details §19).
 *
 * Three decisions carry most of this component's weight:
 *
 * 1. **Below 768px it stops being a table.** A four-column table on a 375px
 *    screen is either a horizontal scroller nobody discovers or six-point text.
 *    When a `mobileCard` renderer is supplied the component renders a card list
 *    instead — same data, a layout that fits the hand. Without `mobileCard` it
 *    keeps the real table inside a horizontal scroll container, because silently
 *    dropping columns loses information.
 *
 * 2. **The breakpoint is read through `useSyncExternalStore`.** A `useEffect` +
 *    `useState` matchMedia hook renders the desktop table on the server and on
 *    the first client paint, then swaps to cards — a visible flash and a
 *    hydration mismatch. `useSyncExternalStore` has a dedicated server snapshot,
 *    so the server commits to one presentation and the client agrees with it.
 *
 * 3. **Sorting is delegated, never performed here.** `onSort` fires and the
 *    caller re-fetches or re-sorts. Tables that sort their own `rows` prop lie
 *    the moment the data is paginated — page 2 sorted by name would sort only
 *    the twenty rows already in the browser. The component owns the *indicator*
 *    and `aria-sort`; the data owner owns the order.
 *
 * Numerals follow the platform law: `numeric` columns are right-aligned and
 * mono with tabular figures, so digits line up column-wise and never jitter.
 */

const MOBILE_BREAKPOINT = '(max-width: 767px)'

/**
 * SSR-safe media query subscription.
 *
 * `getServerSnapshot` returns false — the server renders the desktop table. It
 * has to pick something, and picking the semantically richer markup means a
 * crawler and a no-JS reader still get real table semantics.
 */
function useIsMobile(): boolean {
  const subscribe = React.useCallback((onChange: () => void) => {
    const query = window.matchMedia(MOBILE_BREAKPOINT)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_BREAKPOINT).matches,
    () => false
  )
}

export type SortDirection = 'asc' | 'desc'

export type TableColumn<Row> = {
  key: string
  header: string
  /** Right-aligns and renders mono. Use for counts, amounts, dates, IDs. */
  numeric?: boolean
  sortable?: boolean
  /** Falls back to `String(row[key])` when omitted. */
  render?: (row: Row) => React.ReactNode
}

export type TableProps<Row> = {
  columns: TableColumn<Row>[]
  rows: Row[]
  /** Fires on a sortable header activation. The caller reorders the data. */
  onSort?: (key: string, dir: SortDirection) => void
  /** Below 768px, renders this per row instead of the table. */
  mobileCard?: (row: Row) => React.ReactNode
  /**
   * Names the table for assistive tech. Required in practice — an unlabelled
   * table on a page with several is unnavigable by screen reader.
   */
  caption: string
  /** Stable identity per row. Defaults to the index, which is fine for static
   *  lists but wrong for anything reorderable — pass a real id when you have one. */
  getRowKey?: (row: Row, index: number) => React.Key
  className?: string
}

export function Table<Row>({
  columns,
  rows,
  onSort,
  mobileCard,
  caption,
  getRowKey,
  className,
}: TableProps<Row>) {
  const isMobile = useIsMobile()
  const [sort, setSort] = React.useState<{ key: string; dir: SortDirection } | null>(null)

  const rowKey = React.useCallback(
    (row: Row, index: number) => getRowKey?.(row, index) ?? index,
    [getRowKey]
  )

  function handleSort(key: string) {
    // First click on a new column sorts ascending; clicking the active column
    // flips it. Never a third "unsorted" state — returning to no order gives the
    // user nothing they wanted and costs another request.
    const dir: SortDirection = sort?.key === key && sort.dir === 'asc' ? 'desc' : 'asc'
    setSort({ key, dir })
    onSort?.(key, dir)
  }

  if (isMobile && mobileCard) {
    return (
      <ul className={cn('flex flex-col gap-3', className)} aria-label={caption}>
        {rows.map((row, index) => (
          <li key={rowKey(row, index)}>{mobileCard(row)}</li>
        ))}
      </ul>
    )
  }

  return (
    // TODO(S127): virtualise beyond 200 rows via @tanstack/react-virtual. The
    // requirement is admin-only (audit log, payments ledger) where result sets
    // run to thousands; public surfaces paginate long before this matters. The
    // package is not installed and is deliberately out of scope here — it lands
    // as an admin-only chunk so the public bundle budget is unaffected.
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-border border-b">
            {columns.map((column) => {
              const isActive = sort?.key === column.key
              const ariaSort = !column.sortable
                ? undefined
                : isActive
                  ? sort.dir === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={cn(
                    'text-muted px-3 py-2 text-xs font-medium tracking-wide uppercase',
                    column.numeric ? 'text-right' : 'text-left'
                  )}
                >
                  {column.sortable ? (
                    // A real button, so the header is reachable by Tab and
                    // activated by Enter or Space for free. A th with onClick
                    // is invisible to a keyboard.
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className={cn(
                        'inline-flex min-h-11 items-center gap-1 rounded-[--radius-tag]',
                        // Named property, never `all`.
                        'transition-[color] duration-150',
                        'hover:text-foreground',
                        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                        column.numeric && 'flex-row-reverse'
                      )}
                    >
                      {column.header}
                      {isActive ? (
                        sort.dir === 'asc' ? (
                          <ChevronUp className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="size-3.5" aria-hidden="true" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              className={cn(
                'border-border border-b last:border-b-0',
                'hover:bg-card-subtle transition-[background-color] duration-150'
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'text-body h-12 px-3 align-middle',
                    column.numeric ? 'text-right font-mono tabular-nums' : 'text-left'
                  )}
                >
                  {column.render
                    ? column.render(row)
                    : String((row as Record<string, unknown>)[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
