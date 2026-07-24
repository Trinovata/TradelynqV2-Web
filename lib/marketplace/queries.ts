/**
 * Public marketplace reads (playbook S078 foundation).
 *
 * The server-side data layer for the public surfaces. Every query here returns
 * only what a signed-out visitor may see: active listings, and never the
 * contact fields that sit behind the reveal gate. Shaping into the card
 * view-model happens through `buildProfessionalCardData`, so the search page,
 * the landing rails, and the category pages all render identical cards.
 */
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import {
  buildProfessionalCardData,
  type ProfessionalCardData,
} from '@/lib/marketplace/professional-card'

/** Columns needed to build a card. Contact fields are deliberately absent. */
export const CARD_COLUMNS =
  'id, user_id, slug, business_name, tagline, profile_photo_url, category_id, ' +
  'availability, business_type, service_areas, services, verification_status, ' +
  'national_id_verified, has_insurance, listing_status, average_rating, review_count'

export type CardRow = Record<string, unknown>

/**
 * Resolves the category name and the owner's subtype for a batch of rows in two
 * lookups rather than N — a card list of 20 must not fan out into 40 queries.
 *
 * Exported so the search action and the read helpers shape cards identically;
 * a divergence here would make the same professional look different on the
 * search page than on the landing.
 */
export async function decorateCards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: CardRow[]
): Promise<ProfessionalCardData[]> {
  if (rows.length === 0) return []

  const categoryIds = [...new Set(rows.map((r) => r.category_id).filter(Boolean))] as string[]
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]

  const [{ data: categories }, { data: profiles }] = await Promise.all([
    categoryIds.length
      ? supabase.from('categories').select('id, slug, name').in('id', categoryIds)
      : Promise.resolve({ data: [] as { id: string; slug: string; name: string }[] }),
    userIds.length
      ? // profiles' RLS hides professional_subtype from anon/other users, so a
        // direct join returns nothing. This SECURITY DEFINER RPC exposes it only
        // for active-listed professionals — exactly what the badge already shows.
        supabase.rpc('professional_subtypes', { p_user_ids: userIds })
      : Promise.resolve({ data: [] as { user_id: string; professional_subtype: string | null }[] }),
  ])

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]))
  const subtypeByUser = new Map((profiles ?? []).map((p) => [p.user_id, p.professional_subtype]))

  return rows.map((row) =>
    buildProfessionalCardData(row as never, {
      category: categoryById.get(row.category_id as string) ?? null,
      subtype: subtypeByUser.get(row.user_id as string) ?? null,
    })
  )
}

/**
 * Active listings for the landing rails and proof strip.
 *
 * Ordered rating-first: the strongest supply leads. Subscribed-first ranking
 * (D-era: paying professionals surface above free ones) is not applied yet —
 * the subscriptions join is not modelled in this read. FLAG: wire it when the
 * subscription read lands (S037/S131), so the landing does not silently rank
 * purely on rating forever.
 */
export async function getFeaturedProfessionals(limit = 12): Promise<ProfessionalCardData[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('professional_profiles')
    .select(CARD_COLUMNS)
    .eq('listing_status', 'active')
    .order('average_rating', { ascending: false, nullsFirst: false })
    .order('review_count', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return decorateCards(supabase, data as unknown as CardRow[])
}

// ── Storefront ───────────────────────────────────────────────────────────────

export type StorefrontReview = {
  id: string
  reviewerLabel: string
  date: string
  stars: 1 | 2 | 3 | 4 | 5
  testimonial: string
  verifiedJob: boolean
  seeded: boolean
}

/** Contact details, present only after a server-verified reveal (D13). */
export type StorefrontContact = { phone: string | null; whatsapp: string | null }

export type Storefront = {
  id: string
  slug: string
  name: string
  /**
   * First name of the owner, for the rail's `Contact {first name}` and the
   * enquiry modal (copy-public.md §5.9/§5.11). Falls back to the business name.
   */
  ownerFirstName: string
  tagline: string | null
  bio: string | null
  avatarUrl: string | null
  coverUrl: string | null
  category: { slug: string; name: string } | null
  areas: string[]
  services: { name: string; price_ttd?: number; description?: string }[]
  businessHours: unknown
  /** Public links (anon column grant) — rendered on the REVEALED rail (§5.9). */
  websiteUrl: string | null
  instagramHandle: string | null
  verification: { idVerified: boolean; insured: boolean; fullyVerified: boolean }
  track: 'student' | 'sole_trader' | 'registered'
  rating: { average: number; count: number } | null
  distribution: Record<'5' | '4' | '3' | '2' | '1', number>
  reviews: StorefrontReview[]
  /**
   * Present ONLY once the reveal gate passes (S083, via `getViewerGateState` /
   * `POST /api/connections`). Always null on this public path — the fields are
   * never selected, so they cannot leak by a rendering mistake.
   */
  contact: StorefrontContact | null
}

/**
 * Masks a reviewer's name to first-name + last initial ("Simone J."), never the
 * raw stored name. A review is public; the reviewer's full identity is not.
 */
function maskReviewer(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0] ?? 'A client'
  const first = parts[0] ?? ''
  const lastInitial = (parts[parts.length - 1] ?? '').charAt(0)
  return lastInitial ? `${first} ${lastInitial}.` : first
}

/**
 * The full public storefront for a slug, or null when there is no active listing.
 *
 * Contact fields (phone, WhatsApp, home address) are NOT in the column list, so
 * they are absent from the payload by construction rather than blanked after the
 * fact — the reveal gate (S083) is what later grants them, through a separate
 * path. Reviews are limited to approved/featured and masked.
 */
type StorefrontRow = {
  id: string
  user_id: string
  slug: string | null
  business_name: string
  owner_name: string | null
  tagline: string | null
  bio: string | null
  profile_photo_url: string | null
  cover_photo_url: string | null
  category_id: string | null
  service_areas: string[] | null
  services: unknown
  business_hours: unknown
  website_url: string | null
  instagram_handle: string | null
  verification_status: string
  national_id_verified: boolean
  has_insurance: boolean
  average_rating: number | null
  review_count: number | null
}

export async function getProfessionalBySlug(slug: string): Promise<Storefront | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('professional_profiles')
    .select(
      'id, user_id, slug, business_name, owner_name, tagline, bio, profile_photo_url, ' +
        'cover_photo_url, category_id, service_areas, services, business_hours, ' +
        'website_url, instagram_handle, verification_status, ' +
        'national_id_verified, has_insurance, average_rating, review_count, listing_status'
    )
    .eq('slug', slug)
    .eq('listing_status', 'active')
    .maybeSingle()

  if (error || !data) return null
  const row = data as unknown as StorefrontRow

  const [{ data: category }, { data: subtypeRows }, { data: reviews }] = await Promise.all([
    row.category_id
      ? supabase.from('categories').select('slug, name').eq('id', row.category_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Via the RPC, not a profiles join — profiles' RLS hides professional_subtype
    // from anon/other users, which made the badge always read 'sole_trader'.
    supabase.rpc('professional_subtypes', { p_user_ids: [row.user_id] }),
    supabase
      .from('reviews')
      .select(
        'id, reviewer_name, star_rating, testimonial, status, is_seeded, job_enquiry_id, created_at'
      )
      .eq('professional_id', row.id)
      .in('status', ['approved', 'featured'])
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const distribution: Record<'5' | '4' | '3' | '2' | '1', number> = {
    '5': 0,
    '4': 0,
    '3': 0,
    '2': 0,
    '1': 0,
  }
  const storefrontReviews: StorefrontReview[] = (reviews ?? []).map((r) => {
    const stars = Math.min(5, Math.max(1, r.star_rating)) as 1 | 2 | 3 | 4 | 5
    distribution[String(stars) as '5' | '4' | '3' | '2' | '1'] += 1
    return {
      id: r.id,
      reviewerLabel: maskReviewer(r.reviewer_name),
      date: new Date(r.created_at).toLocaleDateString('en-TT', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      stars,
      testimonial: r.testimonial,
      verifiedJob: Boolean(r.job_enquiry_id),
      seeded: r.is_seeded,
    }
  })

  const subtype = subtypeRows?.[0]?.professional_subtype ?? null
  const track =
    subtype === 'student_entrepreneur'
      ? 'student'
      : subtype === 'registered_business'
        ? 'registered'
        : 'sole_trader'

  const reviewCount = row.review_count ?? 0

  return {
    id: row.id,
    slug: row.slug ?? row.id,
    name: row.business_name,
    ownerFirstName: row.owner_name?.trim().split(/\s+/)[0] || row.business_name,
    tagline: row.tagline,
    bio: row.bio,
    avatarUrl: row.profile_photo_url,
    coverUrl: row.cover_photo_url,
    category: category ? { slug: category.slug, name: category.name } : null,
    areas: row.service_areas ?? [],
    services: Array.isArray(row.services) ? (row.services as Storefront['services']) : [],
    businessHours: row.business_hours,
    websiteUrl: row.website_url,
    instagramHandle: row.instagram_handle,
    verification: {
      idVerified: row.national_id_verified,
      insured: row.has_insurance,
      fullyVerified: row.verification_status === 'fully_verified',
    },
    track,
    // D40: a numeric rating shows only from the third approved review.
    rating:
      reviewCount >= 3 && row.average_rating !== null
        ? { average: row.average_rating, count: reviewCount }
        : null,
    distribution,
    reviews: storefrontReviews,
    contact: null,
  }
}

// ── Viewer gate state (S083) ─────────────────────────────────────────────────

export type ViewerGateState = {
  /** A connection row exists for this (viewer, professional) pair. */
  revealed: boolean
  /** Present ONLY when revealed — selected by explicit column list. */
  contact: StorefrontContact | null
  connectionCount: number
  kycStatus: string | null
  /**
   * The viewer owns a customer_profiles row. False for a professional or admin
   * browsing a storefront — surfaces hide customer-only affordances (the save
   * toggle) rather than offering an action the API will 403.
   */
  isCustomer: boolean
}

/**
 * The signed-in viewer's gate state for one professional, read server-side so
 * the storefront's first paint already shows a revealed rail to a returning
 * customer. Returns null when nobody is signed in.
 *
 * The customer's own `connections` rows are RLS-visible, so the pair check runs
 * on the RLS client. The contact columns are selected ONLY once the pair row is
 * confirmed, and by explicit column list — `authenticated` has table-wide
 * SELECT on active rows, so redaction IS the column list (migration
 * 20260719000005: "Redaction is the API's job … anything reading this table
 * directly for a public surface MUST select an explicit column list").
 *
 * For a non-customer viewer (a professional browsing a peer) the
 * customer_profiles lookup returns nothing and the state degrades to the
 * unrevealed rail; the API answers any reveal attempt with FORBIDDEN_ROLE.
 */
export async function getViewerGateState(professionalId: string): Promise<ViewerGateState | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: pair }] = await Promise.all([
    supabase
      .from('customer_profiles')
      .select('connection_count, kyc_status')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('connections')
      .select('id')
      .eq('customer_id', user.id)
      .eq('professional_id', professionalId)
      .maybeSingle(),
  ])

  const revealed = Boolean(pair)

  let contact: StorefrontContact | null = null
  if (revealed) {
    const { data: pro } = await supabase
      .from('professional_profiles')
      .select('contact_phone, contact_whatsapp')
      .eq('id', professionalId)
      .maybeSingle()
    if (pro) contact = { phone: pro.contact_phone, whatsapp: pro.contact_whatsapp }
  }

  return {
    revealed,
    contact,
    connectionCount: profile?.connection_count ?? 0,
    kycStatus: profile?.kyc_status ?? null,
    // A customer always owns a customer_profiles row (created at role
    // assignment); its absence means a professional or admin is browsing.
    isCustomer: profile !== null,
  }
}

export type CategoryTreeNode = {
  parent: { slug: string; name: string; icon: string | null }
  children: { slug: string; name: string }[]
}

/** The hierarchical category taxonomy for the landing grid and SEO pages. */
export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('slug, name, icon, parent_slug, display_order, is_active')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error || !data) return []

  const parents = data.filter((c) => c.parent_slug === null)
  return parents.map((parent) => ({
    parent: { slug: parent.slug, name: parent.name, icon: parent.icon },
    children: data
      .filter((c) => c.parent_slug === parent.slug)
      .map((c) => ({ slug: c.slug, name: c.name })),
  }))
}
