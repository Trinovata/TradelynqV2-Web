/**
 * SEO landing page reads (playbook S087, spec v2/03 §3.7).
 *
 * Server-only, RSC-consumed, anon-safe by construction: every query runs on
 * the RLS client and selects through the same CARD_COLUMNS path as search, so
 * these pages can never render a column the marketplace would not.
 */
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { CARD_COLUMNS, decorateCards, type CardRow } from '@/lib/marketplace/queries'
import type { ProfessionalCardData } from '@/lib/marketplace/professional-card'

export type ParentCategory = {
  slug: string
  name: string
  children: { slug: string; name: string; id: string }[]
}

/** A parent category with its children, or null for an unknown/child slug. */
export async function getParentCategory(slug: string): Promise<ParentCategory | null> {
  const supabase = await createClient()
  const { data: parent } = await supabase
    .from('categories')
    .select('slug, name')
    .eq('slug', slug)
    .is('parent_slug', null)
    .eq('is_active', true)
    .maybeSingle()
  if (!parent) return null

  const { data: children } = await supabase
    .from('categories')
    .select('id, slug, name')
    .eq('parent_slug', slug)
    .eq('is_active', true)
    .order('display_order')

  return { slug: parent.slug, name: parent.name, children: children ?? [] }
}

/** A child category row (the [category] segment of the area pages). */
export async function getChildCategory(
  slug: string
): Promise<{ id: string; slug: string; name: string; parentSlug: string | null } | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, slug, name, parent_slug')
    .eq('slug', slug)
    .not('parent_slug', 'is', null)
    .eq('is_active', true)
    .maybeSingle()
  return data
    ? { id: data.id, slug: data.slug, name: data.name, parentSlug: data.parent_slug }
    : null
}

/** Rating-ordered active professionals across a parent's children (§8.1 grid). */
export async function getTopProfessionalsForParent(
  parent: ParentCategory,
  limit = 12
): Promise<ProfessionalCardData[]> {
  if (parent.children.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('professional_profiles')
    .select(CARD_COLUMNS)
    .in(
      'category_id',
      parent.children.map((c) => c.id)
    )
    .eq('listing_status', 'active')
    .order('average_rating', { ascending: false, nullsFirst: false })
    .order('review_count', { ascending: false })
    .limit(limit)
  if (!data) return []
  return decorateCards(supabase, data as unknown as CardRow[])
}

/** Active professionals in one child category serving one area (§8.2 list). */
export async function getProfessionalsByCategoryArea(
  categoryId: string,
  area: string,
  limit = 24
): Promise<ProfessionalCardData[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('professional_profiles')
    .select(CARD_COLUMNS)
    .eq('category_id', categoryId)
    .eq('listing_status', 'active')
    .contains('service_areas', [area])
    .order('average_rating', { ascending: false, nullsFirst: false })
    .order('review_count', { ascending: false })
    .limit(limit)
  if (!data) return []
  return decorateCards(supabase, data as unknown as CardRow[])
}

/** Every active storefront slug — the sitemap's professional section. */
export async function getActiveStorefrontSlugs(): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('professional_profiles')
    .select('slug')
    .eq('listing_status', 'active')
    .not('slug', 'is', null)
    .limit(5000)
  return (data ?? []).map((r) => r.slug as string)
}

/** All parent + child category slugs — the sitemap's category section. */
export async function getAllCategorySlugs(): Promise<{ parents: string[]; children: string[] }> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('slug, parent_slug')
    .eq('is_active', true)
  const parents = (data ?? []).filter((c) => c.parent_slug === null).map((c) => c.slug)
  const children = (data ?? []).filter((c) => c.parent_slug !== null).map((c) => c.slug)
  return { parents, children }
}
