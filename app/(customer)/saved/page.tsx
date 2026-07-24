import type { Metadata } from 'next'
import { Heart } from 'lucide-react'
import { getSavedProfessionals } from '@/lib/marketplace/saved'
import { ProfessionalCard } from '@/components/shared/ProfessionalCard'
import { EmptyState } from '@/components/ui/States'

/**
 * Saved professionals — /saved (playbook S084 landing surface; full S101 scope
 * later). Copy verbatim from copy-customer.md §9.
 *
 * This page exists now because the SaveButton success toast offers "View
 * saved" — an action must never land on a 404. The S101 close-out adds the
 * optimistic unsave-with-undo (order-restoring) and pagination past 24; until
 * then the card grid reads through the same CARD_COLUMNS path as search, so a
 * saved professional looks identical everywhere.
 */
export const metadata: Metadata = { title: 'Saved Professionals' }

export default async function SavedPage() {
  const professionals = await getSavedProfessionals()
  const n = professionals.length

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-foreground font-display text-3xl tracking-tight">
          Saved Professionals
        </h1>
        <p className="text-muted mt-1 text-sm">
          {n > 0 ? (
            <>
              <span className="font-mono tabular-nums">{n}</span> saved professional
              {n === 1 ? '' : 's'}
            </>
          ) : (
            'Professionals you save will appear here.'
          )}
        </p>
      </header>

      {n === 0 ? (
        <EmptyState
          icon={Heart}
          heading="No saved professionals yet"
          body="Browse professionals and tap the save button to keep track of your favourites."
          action={{ label: 'Browse professionals', href: '/search' }}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((pro, index) => (
            <li key={pro.id}>
              <ProfessionalCard data={pro} variant="grid" position={index + 1} source="saved" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
