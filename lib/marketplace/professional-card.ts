/**
 * The ProfessionalCard view-model (playbook S074, spec `components-patterns.md` §1).
 *
 * ProfessionalCard is "the consolidation keystone" — one card for every place a
 * professional is listed, replacing V1's separate WorkerCard and BusinessCard.
 * That only works if there is one shape behind it, so this module owns the
 * normalisation from a `professional_profiles` row to the card's data.
 *
 * The card component stays presentational and never touches a database row: a
 * component that reshapes its own data is a component that reshapes it
 * differently on the search page than on the saved page. This is the single
 * place the mapping lives.
 */
import type { Database } from '@/types/database'

type ProfessionalRow = Database['public']['Tables']['professional_profiles']['Row']
type CategoryRow = Database['public']['Tables']['categories']['Row']

/** Where a profile view originated — forwarded to `profile_viewed` analytics. */
export type ProfileViewSource =
  | 'search'
  | 'category'
  | 'saved'
  | 'rail_recommended'
  | 'rail_related'
  | 'admin_preview'
  | 'catalogue'

/** The unified card data. Built here, consumed by the component unchanged. */
export type ProfessionalCardData = {
  id: string
  slug: string
  name: string
  avatarUrl: string | null
  category: { slug: string; name: string }
  areas: string[]
  /** null until 3+ approved reviews (D40) — below that the card shows a "New" chip. */
  rating: { average: number; count: number } | null
  distribution?: Record<'5' | '4' | '3' | '2' | '1', number>
  verification: { idVerified: boolean; insured: boolean; fullyVerified: boolean }
  track: 'student' | 'sole_trader' | 'registered'
  fromPriceTTD?: number
  /** RP2: server-computed, only when there are ≥5 data points. */
  responseHint?: string
  sponsored?: boolean
}

/** Maps the DB subtype to the card's shorter track label. */
function trackFor(subtype: string | null): ProfessionalCardData['track'] {
  switch (subtype) {
    case 'student_entrepreneur':
      return 'student'
    case 'registered_business':
      return 'registered'
    default:
      return 'sole_trader'
  }
}

/**
 * Derives the lowest offering price from the `services` JSONB.
 *
 * Defensive by necessity: `services` is free-form JSON on the row, so every
 * entry is validated before its price counts. A malformed entry is skipped, not
 * thrown on — a bad services blob must not blank the whole card.
 */
function fromPrice(services: ProfessionalRow['services']): number | undefined {
  if (!Array.isArray(services)) return undefined

  const prices = services
    .map((service) => {
      if (typeof service !== 'object' || service === null) return null
      const value = (service as Record<string, unknown>).price_ttd
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
    })
    .filter((price): price is number => price !== null)

  return prices.length > 0 ? Math.min(...prices) : undefined
}

export type BuildCardOptions = {
  category: Pick<CategoryRow, 'slug' | 'name'> | null
  subtype: string | null
  sponsored?: boolean
  responseHint?: string
  distribution?: Record<'5' | '4' | '3' | '2' | '1', number>
}

/**
 * Builds the card data from a professional row.
 *
 * `average_rating` and `review_count` are trigger-maintained on the row, so the
 * card trusts them rather than recomputing. The D40 threshold (3+ reviews before
 * a numeric rating shows) is applied HERE, once, so no caller can accidentally
 * render a "5.0 from 1 review" card.
 */
export function buildProfessionalCardData(
  row: ProfessionalRow,
  options: BuildCardOptions
): ProfessionalCardData {
  const reviewCount = row.review_count ?? 0
  const average = row.average_rating

  return {
    id: row.id,
    slug: row.slug ?? row.id,
    name: row.business_name,
    avatarUrl: row.profile_photo_url,
    category: options.category
      ? { slug: options.category.slug, name: options.category.name }
      : { slug: 'uncategorised', name: 'Professional' },
    areas: row.service_areas ?? [],
    // D40: a rating shows only from the third approved review. Below that the
    // count is real but the average is withheld and the card renders "New".
    rating: reviewCount >= 3 && average !== null ? { average, count: reviewCount } : null,
    distribution: options.distribution,
    verification: {
      idVerified: row.national_id_verified,
      insured: row.has_insurance,
      fullyVerified: row.verification_status === 'fully_verified',
    },
    track: trackFor(options.subtype),
    fromPriceTTD: fromPrice(row.services),
    responseHint: options.responseHint,
    sponsored: options.sponsored,
  }
}
