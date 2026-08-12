import type { Metadata } from 'next'
import { getSavedProfessionals } from '@/lib/marketplace/saved'
import { SavedGrid } from './SavedGrid'

/**
 * Saved professionals — /saved (playbook S101, copy verbatim copy-customer.md
 * §9). The grid reads through the same CARD_COLUMNS path as search, so a saved
 * professional looks identical everywhere; SavedGrid adds the optimistic
 * unsave-with-undo (order-restoring) the deck specifies. Pagination past 24 is
 * still a follow-up — the current cap is generous for launch supply.
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

      <SavedGrid initial={professionals} />
    </div>
  )
}
