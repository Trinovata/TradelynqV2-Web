'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { motion } from '@/lib/motion'

/**
 * Tabs (playbook S069, contract v2/details §14).
 *
 * Three things here are deliberate and non-obvious:
 *
 * 1. **The underline slides on `transform`, not `left`/`width`.** A single
 *    indicator element is translated and scaled to sit under the active
 *    trigger (M14). Animating `left` or `width` would run layout on every
 *    frame; `transform` composites. The scale is taken against the list's
 *    full scroll width so the indicator stays exact inside a horizontally
 *    scrolling list — that base width is set inline and only changes on
 *    resize, so it never animates.
 *
 * 2. **`urlSync` lives in a child component.** `useSearchParams()` opts the
 *    whole subtree into dynamic rendering, so calling it unconditionally
 *    would penalise every static page that uses plain Tabs. The hooks are
 *    isolated in `<UrlSync>`, which is only mounted when `urlSync` is set.
 *    (Callers using `urlSync` must have a Suspense boundary above them —
 *    Next's requirement for `useSearchParams`, not ours.)
 *
 * 3. **Counts render in mono with tabular figures.** Every numeral on the
 *    platform does (DESIGN.md), and here it earns its keep: a count ticking
 *    from 9 to 10 must not nudge the tab label sideways.
 */

/**
 * Separator used to flatten the tab values into a single primitive for effect
 * dependencies. A NUL byte cannot appear in a URL search-param value, so it
 * can never collide with a real tab value.
 */
const TAB_VALUE_SEPARATOR = '\u0000'

export type TabItem<T extends string> = {
  value: T
  label: string
  count?: number
}

export type TabsProps<T extends string> = {
  tabs: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  /**
   * A search-param key. When set, the active tab reads from and writes to
   * that param, so the selection survives a refresh and travels in a shared
   * link.
   */
  urlSync?: string
  /** Accessible name for the tab list. */
  label?: string
  /** Panels. Compose with `<TabPanel value=…>`. */
  children?: React.ReactNode
  className?: string
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  urlSync,
  label,
  children,
  className,
}: TabsProps<T>) {
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const triggerRefs = React.useRef(new Map<string, HTMLButtonElement>())

  // `base` is the width the indicator is rendered at; `scale` shrinks it to
  // the active trigger. Both are 0 until the first measurement, which keeps
  // the indicator invisible rather than flashing at full width.
  const [indicator, setIndicator] = React.useState({ base: 0, x: 0, scale: 0 })

  const measure = React.useCallback(() => {
    const list = listRef.current
    const active = triggerRefs.current.get(value)
    if (!list || !active) return

    const base = list.scrollWidth
    setIndicator({
      base,
      x: active.offsetLeft,
      scale: base > 0 ? active.offsetWidth / base : 0,
    })
  }, [value])

  // Layout effect: measuring after paint would show the indicator in the old
  // position for a frame on first render.
  React.useLayoutEffect(() => {
    measure()
  }, [measure, tabs])

  React.useEffect(() => {
    const list = listRef.current
    if (!list || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => measure())
    observer.observe(list)
    return () => observer.disconnect()
  }, [measure])

  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className={className}
    >
      {urlSync && <UrlSync paramKey={urlSync} tabs={tabs} value={value} onChange={onChange} />}

      <div className="relative">
        <TabsPrimitive.List
          ref={listRef}
          aria-label={label}
          className="border-border relative flex [scrollbar-width:none] overflow-x-auto border-b [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => (
            <TabsPrimitive.Trigger
              key={tab.value}
              value={tab.value}
              ref={(node) => {
                if (node) triggerRefs.current.set(tab.value, node)
                else triggerRefs.current.delete(tab.value)
              }}
              className={cn(
                // 44px tall: the visual is a text row, the hit area is not.
                'inline-flex h-11 shrink-0 items-center gap-2 px-4 text-sm font-medium whitespace-nowrap',
                'transition-colors duration-150',
                'focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'text-muted hover:text-body data-[state=active]:text-foreground'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="text-muted font-mono text-xs tabular-nums">{tab.count}</span>
              )}
            </TabsPrimitive.Trigger>
          ))}

          {/* Decorative: the active tab is already announced by Radix. */}
          <span
            aria-hidden="true"
            className={cn(
              'bg-accent pointer-events-none absolute bottom-0 left-0 h-0.5',
              motion('tabSlide')
            )}
            style={{
              width: indicator.base || undefined,
              transform: `translateX(${indicator.x}px) scaleX(${indicator.scale})`,
              transformOrigin: 'left',
            }}
          />
        </TabsPrimitive.List>

        {/* Edge fade — tells the reader the row scrolls. Mobile only; on
            desktop the list fits and a fade would just look like a bug. */}
        <span
          aria-hidden="true"
          className="from-background pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l sm:hidden"
        />
      </div>

      {children}
    </TabsPrimitive.Root>
  )
}

export type TabPanelProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>

export function TabPanel({ className, ...props }: TabPanelProps) {
  return (
    <TabsPrimitive.Content
      className={cn(
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        className
      )}
      {...props}
    />
  )
}

/**
 * Keeps the active tab and a URL search param in step.
 *
 * The hard part is telling "the user clicked a tab" apart from "the URL
 * changed underneath us" (back button, pasted link). Both look like
 * `param !== value`, and guessing wrong either strands the URL or bounces the
 * user back to the previous tab.
 *
 * So we remember the last param value we saw. If the param itself moved, the
 * URL is the newer fact and we adopt it; otherwise the local value is newer
 * and we write it out. The ref starts as `undefined` — a value the param can
 * never hold — so the very first render always counts as "the URL moved",
 * which is what makes a refresh and a shared link restore the right tab.
 */
function UrlSync<T extends string>({
  paramKey,
  tabs,
  value,
  onChange,
}: {
  paramKey: string
  tabs: TabItem<T>[]
  value: T
  onChange: (value: T) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const fromUrl = searchParams.get(paramKey)
  const lastSeenRef = React.useRef<string | null | undefined>(undefined)

  // The set of valid values, flattened to a primitive so the effect does not
  // re-run on every parent render that happens to produce a new `tabs` array
  // identity. A ref would be simpler and is exactly what React 19 forbids
  // (writing a ref during render).
  const tabValues = tabs.map((tab) => tab.value).join(TAB_VALUE_SEPARATOR)

  const search = searchParams.toString()

  React.useEffect(() => {
    if (fromUrl === value) {
      lastSeenRef.current = fromUrl
      return
    }

    const urlMoved = fromUrl !== lastSeenRef.current
    lastSeenRef.current = fromUrl

    // An unrecognised param is ignored rather than trusted — a hand-edited or
    // stale link must not put the component into a state with no matching tab.
    const recognised = fromUrl !== null && tabValues.split(TAB_VALUE_SEPARATOR).includes(fromUrl)

    if (urlMoved && recognised) {
      onChange(fromUrl as T)
      return
    }

    const next = new URLSearchParams(search)
    next.set(paramKey, value)
    // `replace`, not `push`: switching tabs is a view change, not a
    // destination. Pushing would make Back walk every tab the user tried.
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [fromUrl, value, search, tabValues, paramKey, pathname, router, onChange])

  return null
}
