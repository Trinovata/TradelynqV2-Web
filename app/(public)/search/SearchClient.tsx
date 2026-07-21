'use client'

/**
 * The search experience (playbook S079).
 *
 * Every piece here earns its place. The URL is the single source of truth, so a
 * filter change is a navigation, not local state — which means back, refresh,
 * and a shared link all restore the exact view. `useTransition` keeps that
 * navigation feeling instant: the current results stay on screen and dim gently
 * while the next set loads, so the page never flashes empty. Results enter in a
 * short stagger, re-triggered on every new search by keying the grid to the
 * query — motion that confirms "something changed", not decoration.
 *
 * The zero-state is the most considered moment: a search that finds nothing is
 * where people leave, so instead of a dead end it hands off to a human on
 * WhatsApp with the query pre-filled (the RP3 concierge). A miss becomes a lead.
 */
import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, MessageCircle, ArrowRight } from 'lucide-react'
import { ProfessionalCard } from '@/components/shared/ProfessionalCard'
import { ProfessionalCardSkeleton } from '@/components/ui/States'
import { Button } from '@/components/ui/Button'
import { whatsappDigits } from '@/lib/whatsapp'
import type { SearchResult, SearchSort } from '@/lib/actions/search'

type CategoryOption = { slug: string; name: string }

type Props = {
  initialResult: SearchResult
  query: string
  category: string
  area: string
  sort: SearchSort
  categories: CategoryOption[]
}

const SORT_LABELS: Record<SearchSort, string> = {
  relevance: 'Best match',
  rating: 'Top rated',
  newest: 'Newest',
}

const AREAS = ['Port of Spain', 'San Fernando', 'Chaguanas', 'Arima', 'Tobago']

/** The platform's support number for the concierge hand-off (public, no reveal gate). */
const CONCIERGE_PHONE = '+18686270000'

export function SearchClient({ initialResult, query, category, area, sort, categories }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = React.useTransition()
  const [draft, setDraft] = React.useState(query)

  // Keep the box in sync when the query changes underneath us — a chip, the back
  // button, a shared link. React's "adjust state during render" pattern rather
  // than an effect: it applies before paint (no flicker) and does not trigger the
  // cascading-render the effect version would.
  const [syncedQuery, setSyncedQuery] = React.useState(query)
  if (query !== syncedQuery) {
    setSyncedQuery(query)
    setDraft(query)
  }

  /** Build a new URL from the current params plus an override, and navigate. */
  const navigate = React.useCallback(
    (overrides: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString())
      for (const [key, value] of Object.entries(overrides)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      // Any filter change resets to page 1 — page 5 of the old filter is meaningless.
      if (!('page' in overrides)) next.delete('page')
      startTransition(() => router.push(`/search?${next.toString()}`))
    },
    [params, router]
  )

  const { results, total, page, pageSize } = initialResult
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasActiveFilters = Boolean(query || category || area)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* ── Search box ── */}
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          navigate({ q: draft.trim() || undefined })
        }}
        className="border-border bg-card focus-within:border-accent focus-within:ring-ring/20 mb-4 flex items-center gap-2 rounded-[--radius-panel] border p-2 shadow-sm transition-[border-color,box-shadow] duration-200 focus-within:ring-4"
      >
        <Search className="text-muted ml-2 size-5 shrink-0" aria-hidden="true" />
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="What do you need done?"
          aria-label="Describe what you need done"
          className="text-foreground placeholder:text-muted h-10 flex-1 bg-transparent text-base outline-none"
        />
        <Button type="submit" isLoading={pending} loadingLabel="Searching…">
          Search
        </Button>
      </form>

      {/* ── Filters ── */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-muted inline-flex items-center gap-1.5 text-sm">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filter
        </span>

        <FilterSelect
          label="Category"
          value={category}
          options={categories.map((c) => ({ value: c.slug, label: c.name }))}
          onChange={(value) => navigate({ category: value || undefined })}
        />
        <FilterSelect
          label="Area"
          value={area}
          options={AREAS.map((a) => ({ value: a, label: a }))}
          onChange={(value) => navigate({ area: value || undefined })}
        />
        <FilterSelect
          label="Sort"
          value={sort}
          options={(Object.keys(SORT_LABELS) as SearchSort[]).map((s) => ({
            value: s,
            label: SORT_LABELS[s],
          }))}
          onChange={(value) => navigate({ sort: value || undefined })}
          clearable={false}
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => navigate({ q: undefined, category: undefined, area: undefined })}
            className="text-accent-ink hover:bg-card-subtle focus-visible:outline-ring ml-1 rounded-[--radius-control] px-2 py-1 text-sm transition-[background-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Result count ── */}
      <div className="mb-4 flex items-baseline justify-between" aria-live="polite">
        <p className="text-body text-sm">
          {total > 0 ? (
            <>
              <span className="text-foreground font-mono font-medium tabular-nums">{total}</span>{' '}
              {total === 1 ? 'professional' : 'professionals'}
              {query && (
                <>
                  {' '}
                  for “<span className="text-foreground">{query}</span>”
                </>
              )}
            </>
          ) : null}
        </p>
      </div>

      {/* ── Results / states ── */}
      {results.length > 0 ? (
        <div
          // Keying to the query re-mounts the grid on a new search, so the
          // entrance stagger plays again — the motion says "these are new".
          key={`${query}|${category}|${area}|${sort}|${page}`}
          className={
            'grid gap-4 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3 ' +
            (pending ? 'opacity-50' : 'opacity-100')
          }
        >
          {results.map((pro, index) => (
            <div
              key={pro.id}
              className="motion-safe:animate-[tlEnter_360ms_cubic-bezier(0,0,0.2,1)_both]"
              style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
            >
              <ProfessionalCard data={pro} source="search" position={(page - 1) * pageSize + index} />
            </div>
          ))}
        </div>
      ) : pending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProfessionalCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <ZeroState query={query} />
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && results.length > 0 && (
        <nav
          className="mt-10 flex items-center justify-center gap-3"
          aria-label="Search results pages"
        >
          <Button
            variant="secondary"
            disabled={page <= 1 || pending}
            onClick={() => navigate({ page: String(page - 1) })}
          >
            Previous
          </Button>
          <span className="text-muted font-mono text-sm tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= totalPages || pending}
            onClick={() => navigate({ page: String(page + 1) })}
          >
            Next
          </Button>
        </nav>
      )}

      {/* The entrance keyframe, hoisted once (React 19 dedupes by href). */}
      <style href="tl-enter-keyframes" precedence="default">{`
        @keyframes tlEnter {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

/** A compact, accessible native select styled to the token system. */
function FilterSelect({
  label,
  value,
  options,
  onChange,
  clearable = true,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  clearable?: boolean
}) {
  const active = Boolean(value)
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={
          'focus-visible:outline-ring h-9 cursor-pointer appearance-none rounded-full border px-3 pr-8 text-sm transition-[border-color,background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
          (active
            ? 'border-accent bg-accent-soft text-accent-ink'
            : 'border-border bg-card text-body hover:bg-card-subtle')
        }
      >
        {clearable && <option value="">{label}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        className="text-muted pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    </label>
  )
}

/**
 * The zero-state — a search's most fragile moment. Rather than a shrug, it names
 * the miss plainly and offers the one thing a stuck visitor actually wants: a
 * person. The WhatsApp link carries the query, so the conversation starts with
 * context, not "how can I help?".
 */
function ZeroState({ query }: { query: string }) {
  const message = query
    ? `Hi TradeLynq — I'm looking for help with "${query}" and couldn't find a match on the site.`
    : `Hi TradeLynq — I'm looking for a professional and could use a hand.`
  // The concierge message is dynamic free text (the query), which the closed
  // template union deliberately cannot carry — so the link is built directly
  // from the normalised number.
  const digits = whatsappDigits(CONCIERGE_PHONE)
  const href = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : undefined

  return (
    <div className="border-border bg-card-subtle mx-auto flex max-w-lg flex-col items-center gap-4 rounded-[--radius-panel] border border-dashed px-6 py-16 text-center">
      <div className="bg-card text-muted flex size-12 items-center justify-center rounded-full">
        <Search className="size-6" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-lg font-medium">
          {query ? (
            <>
              No matches for “<span className="text-accent-ink">{query}</span>” yet
            </>
          ) : (
            'No professionals here yet'
          )}
        </h2>
        <p className="text-body text-sm">
          Try different words or a nearby area — or let us find someone for you. Tell us what you
          need on WhatsApp and we&rsquo;ll point you to the right person.
        </p>
      </div>
      {href && (
        <Button asChild>
          <a href={href} target="_blank" rel="noreferrer">
            <MessageCircle className="size-4" aria-hidden="true" />
            Ask us on WhatsApp
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        </Button>
      )}
    </div>
  )
}
