'use client'

/**
 * The hero's project search (playbook S077).
 *
 * The whole landing hangs off one idea, borrowed from the best marketplaces and
 * given a T&T spin: you do not hunt for a category, you *describe what you need*
 * — "fix a leaking pipe", "nails for my wedding", "build me a website" — and we
 * find who does it. So this is not a keyword box; it is an invitation to say the
 * problem in your own words.
 *
 * Three touches make it feel alive rather than generated:
 *   - the placeholder cycles through real T&T projects, so the box teaches you
 *     how to use it just by watching it;
 *   - quick-start chips turn the most common jobs into one tap;
 *   - it stays a small client island, so the page around it renders instantly.
 *
 * The query routes to /search, where full-text search matches it against real
 * professionals. No LLM round-trip in the hot path — the natural-language feel
 * comes from the framing and the ranking, not a spinner.
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight, MapPin } from 'lucide-react'

const EXAMPLES = [
  'fix a leaking pipe in Chaguanas',
  'nail tech for my wedding',
  'build me a business website',
  'AC servicing before Carnival',
  'a photographer for a christening',
  'CSEC maths tutor in San Fernando',
]

const QUICK_STARTS = [
  { label: 'Electrician', query: 'electrician' },
  { label: 'Hairstylist', query: 'hairstylist' },
  { label: 'Plumber', query: 'plumber' },
  { label: 'Photographer', query: 'photographer' },
  { label: 'AC technician', query: 'ac technician' },
  { label: 'Tutor', query: 'tutor' },
]

// Localise aggressively (audit directive): let a visitor self-select into a
// hyperlocal identity in one tap. These route into the area filter.
const AREAS = ['Port of Spain', 'San Fernando', 'Chaguanas', 'Arima', 'Tobago']

export function HeroSearch() {
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const [exampleIndex, setExampleIndex] = React.useState(0)
  const [focused, setFocused] = React.useState(false)

  // Cycle the placeholder while the box is empty and unfocused — it should
  // demonstrate, not distract. Starts at index 0 on server and client alike, so
  // there is no hydration mismatch.
  React.useEffect(() => {
    if (focused || query) return
    const id = setInterval(() => setExampleIndex((i) => (i + 1) % EXAMPLES.length), 2600)
    return () => clearInterval(id)
  }, [focused, query])

  function go(value: string) {
    const trimmed = value.trim()
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search')
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          go(query)
        }}
        role="search"
        className="border-border bg-card focus-within:border-accent focus-within:ring-ring/20 flex items-center gap-2 rounded-[--radius-panel] border p-2 shadow-sm transition-[border-color,box-shadow] duration-200 focus-within:ring-4"
      >
        <Search className="text-muted ml-2 size-5 shrink-0" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={`What do you need done?  e.g. ${EXAMPLES[exampleIndex]}`}
          aria-label="Describe what you need done"
          className="text-foreground placeholder:text-muted h-11 flex-1 bg-transparent text-base outline-none"
        />
        <button
          type="submit"
          aria-label="Find professionals"
          className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:outline-ring flex h-11 items-center gap-2 rounded-[--radius-control] px-4 text-sm font-medium transition-[background-color,transform] duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-5"
        >
          <span className="hidden sm:inline">Find pros</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-muted text-sm">Popular:</span>
        {QUICK_STARTS.map((item) => (
          <button
            key={item.query}
            type="button"
            onClick={() => go(item.query)}
            className="border-border text-body hover:border-accent hover:text-foreground hover:bg-card-subtle focus-visible:outline-ring rounded-full border px-3 py-1 text-sm transition-[color,background-color,border-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="text-muted inline-flex items-center gap-1 text-sm">
          <MapPin className="size-3.5" aria-hidden="true" />
          Near
        </span>
        {AREAS.map((area) => (
          <button
            key={area}
            type="button"
            onClick={() => router.push(`/search?area=${encodeURIComponent(area)}`)}
            className="text-body hover:text-accent-ink focus-visible:outline-ring rounded text-sm underline-offset-4 transition-[color] duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {area}
          </button>
        ))}
      </div>
    </div>
  )
}
