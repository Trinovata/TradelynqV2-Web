/**
 * Server side of onboarding (playbook S107): reading the draft back, and the
 * reference data the wizard needs to render its pickers.
 *
 * Split from `onboarding.ts` because that file is imported by the client wizard
 * for its schemas; anything that touches the database has to stay out of the
 * browser bundle, and `server-only` is what makes that a build error rather
 * than a review comment.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { emptyDraft, type OnboardingDraft, type OnboardingService } from './onboarding'

export type CategoryOption = {
  id: string
  name: string
  /** Parent category name, so the combobox can show "Plumbing · Trades". */
  group: string
  /** Suggested service chips for step 3, from `profile_templates`. */
  suggestions: string[]
}

export type OnboardingContext = {
  /** Null until the first draft save creates the row. */
  professionalId: string | null
  listingStatus: string | null
  slug: string | null
  savedStep: number
  draft: OnboardingDraft
  categories: CategoryOption[]
}

function parseServices(value: unknown): OnboardingService[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    if (typeof row.name !== 'string') return []
    return [
      {
        name: row.name,
        price_ttd: typeof row.price_ttd === 'number' ? row.price_ttd : undefined,
        description: typeof row.description === 'string' ? row.description : undefined,
      },
    ]
  })
}

/**
 * The subtype credential a professional uploads at step 1 — proof of enrolment
 * for a student, a Certificate of Incorporation or BIR number for a registered
 * business.
 *
 * Stored in the existing `certifications` JSONB rather than in new columns, and
 * deliberately NOT in `national_id_url`: that column is the identity ladder an
 * admin verifies, and putting an unrelated document there would make the
 * verification queue's evidence strip show the wrong thing. A Certificate of
 * Incorporation is, precisely, a certification.
 */
export type SubtypeCredentials = {
  registration_doc_url: string | null
  bir_number: string
}

export function parseCredentials(value: unknown): SubtypeCredentials {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { registration_doc_url: null, bir_number: '' }
  }
  const row = value as Record<string, unknown>
  return {
    registration_doc_url:
      typeof row.registration_doc_url === 'string' ? row.registration_doc_url : null,
    bir_number: typeof row.bir_number === 'string' ? row.bir_number : '',
  }
}

/** `profile_templates.suggested_services` is admin-maintained JSONB; accept the
 *  two shapes it is authored in (bare strings, or `{ name }` objects). */
function parseSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string') return [item]
    if (item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string') {
      return [(item as { name: string }).name]
    }
    return []
  })
}

/**
 * Leaf categories, grouped under their parent, with the template suggestions
 * joined on.
 *
 * Only leaves are offered. A professional who picks "Trades" instead of
 * "Plumbing" is invisible to every customer who searches for a plumber, and the
 * SEO pages are built per leaf — so the picker offering a parent would create
 * listings with nowhere to appear.
 */
export async function getCategoryOptions(
  supabase: SupabaseClient<Database>
): Promise<CategoryOption[]> {
  const [{ data: categories }, { data: templates }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, slug, parent_slug, display_order, is_active')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase.from('profile_templates').select('id, suggested_services').eq('is_active', true),
  ])

  if (!categories) return []

  const parentName = new Map(
    categories.filter((c) => c.parent_slug === null).map((c) => [c.slug, c.name])
  )
  const suggestionsByTemplate = new Map(
    (templates ?? []).map((t) => [t.id, parseSuggestions(t.suggested_services)])
  )

  return categories
    .filter((c) => c.parent_slug !== null)
    .map((c) => ({
      id: c.id,
      name: c.name,
      group: (c.parent_slug && parentName.get(c.parent_slug)) || 'Other',
      // Templates are keyed by a readable id that matches either the leaf slug
      // or its parent's — fall back up the tree rather than showing no chips.
      suggestions:
        suggestionsByTemplate.get(c.slug) ??
        (c.parent_slug ? (suggestionsByTemplate.get(c.parent_slug) ?? []) : []),
    }))
}

/**
 * The caller's draft, or an empty one if they have not started.
 *
 * Reads through the caller's own RLS-scoped client:
 * `professional_profiles_select_own` is what scopes this to one row, so a bug
 * in the filter cannot leak someone else's half-finished storefront.
 */
export async function getOnboardingContext(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<OnboardingContext> {
  const [{ data: row }, categories] = await Promise.all([
    supabase
      .from('professional_profiles')
      .select(
        'id, slug, listing_status, onboarding_step, business_name, owner_name, category_id, service_areas, tenure_started, bio, profile_photo_url, services, portfolio_urls, contact_whatsapp, certifications'
      )
      .eq('user_id', userId)
      .maybeSingle(),
    getCategoryOptions(supabase),
  ])

  if (!row) {
    return {
      professionalId: null,
      listingStatus: null,
      slug: null,
      savedStep: 1,
      draft: emptyDraft(),
      categories,
    }
  }

  // Years of experience is stored as `tenure_started` (a date) rather than a
  // number, so the storefront can age it correctly forever instead of showing
  // whatever number was typed in 2026 for the rest of time.
  const yearsExperience = row.tenure_started
    ? Math.max(0, new Date().getUTCFullYear() - new Date(row.tenure_started).getUTCFullYear())
    : null

  const services = parseServices(row.services)
  const credentials = parseCredentials(row.certifications)

  return {
    professionalId: row.id,
    listingStatus: row.listing_status,
    slug: row.slug,
    savedStep: row.onboarding_step,
    draft: {
      businessName: row.business_name ?? '',
      ownerName: row.owner_name ?? '',
      categoryId: row.category_id,
      serviceAreas: row.service_areas ?? [],
      yearsExperience,
      subtypeDocUrl: credentials.registration_doc_url,
      birNumber: credentials.bir_number,
      profilePhotoUrl: row.profile_photo_url,
      bio: row.bio ?? '',
      services: services.length > 0 ? services : [{ name: '' }],
      portfolioUrls: row.portfolio_urls ?? [],
      // Seeded reviews live in `reviews`, are written only at publish, and are
      // never read back into the draft — re-editing an admin-vouched review
      // after submission is exactly the hole `is_seeded` exists to close.
      seedReviews: [],
      contactWhatsapp: row.contact_whatsapp ?? '',
    },
    categories,
  }
}
