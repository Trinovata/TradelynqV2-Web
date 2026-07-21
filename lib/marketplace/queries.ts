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
const CARD_COLUMNS =
  'id, user_id, slug, business_name, tagline, profile_photo_url, category_id, ' +
  'availability, business_type, service_areas, services, verification_status, ' +
  'national_id_verified, has_insurance, listing_status, average_rating, review_count'

type CardRow = Record<string, unknown>

/**
 * Resolves the category name and the owner's subtype for a batch of rows in two
 * lookups rather than N — a card list of 20 must not fan out into 40 queries.
 */
async function decorate(
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
      ? supabase.from('profiles').select('id, professional_subtype').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; professional_subtype: string | null }[] }),
  ])

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]))
  const subtypeByUser = new Map((profiles ?? []).map((p) => [p.id, p.professional_subtype]))

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
  return decorate(supabase, data as unknown as CardRow[])
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
