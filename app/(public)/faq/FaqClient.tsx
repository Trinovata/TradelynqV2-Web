'use client'

/**
 * Help centre body (deck §11.3). Native <details> accordions — free keyboard
 * support and deep-linkable ids without an ARIA re-implementation. The filter
 * matches question + answer text; a no-match state hands off to WhatsApp
 * rather than dead-ending.
 */
import * as React from 'react'
import { MessageCircle } from 'lucide-react'
import { whatsappDigits } from '@/lib/whatsapp'
import { SUPPORT_PHONE } from '@/lib/constants/contact'

export type FaqEntry = { id: string; q: string; a: string }
export type FaqGroup = { heading: string; entries: FaqEntry[] }

export function FaqClient({ groups }: { groups: FaqGroup[] }) {
  const [query, setQuery] = React.useState('')
  const q = query.trim().toLowerCase()

  const filtered = groups
    .map((group) => ({
      ...group,
      entries: q
        ? group.entries.filter(
            (entry) => entry.q.toLowerCase().includes(q) || entry.a.toLowerCase().includes(q)
          )
        : group.entries,
    }))
    .filter((group) => group.entries.length > 0)

  const digits = whatsappDigits(SUPPORT_PHONE)
  const waHref = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent('I have a question about TradeLynq.')}`
    : '/support'

  return (
    <div className="flex flex-col gap-8">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search help articles"
        aria-label="Search help articles"
        className="border-border bg-card text-foreground placeholder:text-muted focus-visible:ring-ring w-full rounded-lg border px-4 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
      />

      {filtered.length === 0 ? (
        <p className="text-body text-sm">
          No answers matched &ldquo;{query.trim()}&rdquo;. Try different words, or{' '}
          <a href={waHref} className="text-foreground underline underline-offset-4">
            message us on WhatsApp
          </a>
          .
        </p>
      ) : (
        filtered.map((group) => (
          <section key={group.heading}>
            <h2 className="text-foreground font-medium">{group.heading}</h2>
            <div className="border-border mt-3 divide-y rounded-[--radius-card] border">
              {group.entries.map((entry) => (
                <details key={entry.id} id={entry.id} className="group scroll-mt-24 px-4">
                  <summary className="text-foreground cursor-pointer list-none py-3 text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                    {entry.q}
                  </summary>
                  <p className="text-body pb-4 text-sm leading-relaxed">{entry.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))
      )}

      <p className="text-body text-sm">
        Still need help?{' '}
        <a
          href={waHref}
          className="text-foreground inline-flex items-center gap-1 underline underline-offset-4"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          Chat on WhatsApp.
        </a>
      </p>
    </div>
  )
}
