'use client'

/**
 * Saved grid with optimistic unsave + undo (playbook S101, deck §9).
 *
 * The heart on each card removes it immediately (optimistic), fires the
 * POST /api/saved toggle, and shows an undo Toast. Undo re-saves and restores
 * the card at its ORIGINAL index — the deck's "unsave-then-undo restores
 * order" acceptance. A failed toggle rolls the card back and says so, never
 * leaving the UI lying about what the server holds.
 */
import * as React from 'react'
import { Heart } from 'lucide-react'
import { ProfessionalCard } from '@/components/shared/ProfessionalCard'
import type { ProfessionalCardData } from '@/lib/marketplace/professional-card'
import { EmptyState } from '@/components/ui/States'
import { toast } from '@/components/ui/Toast'

type Entry = { data: ProfessionalCardData; originalIndex: number }

export function SavedGrid({ initial }: { initial: ProfessionalCardData[] }) {
  const [entries, setEntries] = React.useState<Entry[]>(
    initial.map((data, originalIndex) => ({ data, originalIndex }))
  )

  /**
   * /api/saved is a pure toggle — one call flips the row. From this page a
   * card is always currently-saved, so one toggle unsaves and one toggles
   * back. `expectSaved` verifies the server landed on the state we intended
   * (the response reports it), so an out-of-sync toggle is caught, not hidden.
   */
  const toggle = async (professionalId: string, expectSaved: boolean) => {
    const res = await fetch('/api/saved', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ professional_id: professionalId }),
    })
    if (!res.ok) throw new Error('toggle failed')
    const json = (await res.json().catch(() => null)) as { saved?: boolean } | null
    if (json?.saved !== expectSaved) throw new Error('toggle landed on the wrong state')
  }

  const restore = (entry: Entry) => {
    setEntries((prev) => [...prev, entry].sort((a, b) => a.originalIndex - b.originalIndex))
  }

  const unsave = async (entry: Entry) => {
    // Optimistic removal first.
    setEntries((prev) => prev.filter((e) => e.data.id !== entry.data.id))
    try {
      await toggle(entry.data.id, false)
      toast('Removed from saved.', {
        kind: 'info',
        action: {
          label: 'Undo',
          onClick: async () => {
            restore(entry)
            try {
              await toggle(entry.data.id, true)
              toast('Saved.', { kind: 'success' })
            } catch {
              // Re-save failed: pull it back out and be honest.
              setEntries((prev) => prev.filter((e) => e.data.id !== entry.data.id))
              toast('Couldn’t undo — try saving from their storefront.', { kind: 'error' })
            }
          },
        },
      })
    } catch {
      restore(entry)
      toast('Couldn’t update your saved list. Try again.', { kind: 'error' })
    }
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        heading="No saved professionals yet"
        body="Browse professionals and tap the save button to keep track of your favourites."
        action={{ label: 'Browse professionals', href: '/search' }}
      />
    )
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry, index) => (
        <li key={entry.data.id} className="relative">
          <ProfessionalCard data={entry.data} variant="grid" position={index + 1} source="saved" />
          <button
            type="button"
            onClick={() => unsave(entry)}
            aria-label={`Remove ${entry.data.name} from saved`}
            className="bg-card/90 border-border text-accent-ink hover:bg-card absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full border backdrop-blur transition-colors"
          >
            <Heart className="size-4 fill-current" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}
