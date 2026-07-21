'use client'

/**
 * The persistent header search (Thumbtack audit directive #1).
 *
 * The single non-negotiable conversion object: it lives in the sticky navbar, so
 * however far a visitor scrolls through the trust-building content below, the
 * "describe what you need" box is never more than a glance away. On the landing
 * it sits above the larger hero search; everywhere else it IS the search. Both
 * route to /search, which owns the results.
 *
 * Deliberately compact and quiet — it must not fight the page's primary CTA for
 * attention, only stay reachable.
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export function NavSearch({ className = '' }: { className?: string }) {
  const router = useRouter()
  const [query, setQuery] = React.useState('')

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = query.trim()
        router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search')
      }}
      className={`border-border bg-card-subtle focus-within:border-accent focus-within:bg-card flex h-10 items-center gap-2 rounded-full border px-3 transition-[border-color,background-color] duration-150 ${className}`}
    >
      <Search className="text-muted size-4 shrink-0" aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="What do you need done?"
        aria-label="Describe what you need done"
        className="text-foreground placeholder:text-muted h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
    </form>
  )
}
