'use client'

/**
 * Category combobox (playbook S107, copy `copy-professional.md §4.1`).
 *
 * Search-first with the popular categories visible before anyone types, because
 * the two failure modes of a category picker are opposite: a bare dropdown of
 * 80 leaves is unreadable, and a bare search box shows nothing until you guess
 * the right word. Popular-first plus filter-as-you-type avoids both.
 *
 * Built on a native listbox pattern rather than a library: it is one control,
 * and Radix does not ship a combobox — a dependency for this would be heavier
 * than the 90 lines it replaces.
 */
import * as React from 'react'
import { Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useOnboarding } from './context'

/**
 * Shown before anything is typed. Not "popular" by measured demand — there is
 * none yet — but the categories T&T customers search for most in V1's logs, so
 * the common case is one tap.
 */
const POPULAR = [
  'Plumbing',
  'Electrical',
  'Air Conditioning',
  'Carpentry',
  'Cleaning',
  'Landscaping',
  'Painting',
  'Hairdressing',
  'Masonry',
  'Auto Repair',
]

export function CategoryPicker({
  value,
  onChange,
  error,
}: {
  value: string | null
  onChange: (categoryId: string) => void
  error?: string
}) {
  const { categories } = useOnboarding()
  const [query, setQuery] = React.useState('')
  const inputId = React.useId()
  const errorId = `${inputId}-error`

  const selected = categories.find((option) => option.id === value) ?? null

  const results = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) {
      // Preserve POPULAR's order rather than the taxonomy's: the list is
      // ordered by likelihood, and re-sorting it alphabetically throws that away.
      const byName = new Map(categories.map((option) => [option.name.toLowerCase(), option]))
      const popular = POPULAR.flatMap((name) => {
        const match = byName.get(name.toLowerCase())
        return match ? [match] : []
      })
      // Backfill so a taxonomy that does not contain the popular names still
      // shows something useful.
      const rest = categories.filter((option) => !popular.includes(option))
      return [...popular, ...rest].slice(0, 12)
    }
    return categories
      .filter(
        (option) =>
          option.name.toLowerCase().includes(trimmed) ||
          option.group.toLowerCase().includes(trimmed)
      )
      .slice(0, 24)
  }, [categories, query])

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-foreground text-sm font-medium">
        What do you do? <span className="text-destructive">*</span>
      </label>
      <p className="text-muted text-xs">
        Pick the closest match — you can add more services later.
      </p>

      <div className="relative">
        <Search
          className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls={`${inputId}-list`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder={selected ? selected.name : 'Search categories'}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={cn(
            'border-border bg-card text-foreground placeholder:text-muted h-11 w-full rounded-[--radius-control] border pr-3 pl-9 text-sm',
            'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
            error && 'border-destructive'
          )}
        />
      </div>

      {results.length === 0 ? (
        <p className="text-muted py-3 text-sm">
          No categories match “{query.trim()}”. Try a broader word.
        </p>
      ) : (
        <ul
          id={`${inputId}-list`}
          role="listbox"
          aria-label="Categories"
          className="border-border bg-card mt-1 flex max-h-64 flex-col overflow-y-auto rounded-[--radius-control] border"
        >
          {results.map((option) => {
            const isSelected = option.id === value
            return (
              <li key={option.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.id)
                    setQuery('')
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm',
                    'hover:bg-card-subtle focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2',
                    isSelected && 'bg-accent-soft'
                  )}
                >
                  <span className="min-w-0">
                    <span className="text-foreground block truncate">{option.name}</span>
                    <span className="text-muted block truncate text-xs">{option.group}</span>
                  </span>
                  {isSelected && (
                    <Check className="text-accent-ink size-4 shrink-0" aria-hidden="true" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
