'use server'

/**
 * Marketplace search (playbook S078, ported and simplified from V1).
 *
 * V1's search merged two tables — worker_profiles and business_profiles — and
 * spent most of its length reconciling them. V2 consolidated both into
 * `professional_profiles`, so the same behaviour is one query: this is the
 * "cleaner backend" the consolidation was for.
 *
 * ## Category-aware matching (the fix that makes it actually work)
 *
 * The obvious search — "electrician" — must return the electrician. But the
 * Postgres text stemmer turns "electrical" into `electr` and "electrician" into
 * `electrician`, so they do NOT match, and V2's `search_vector` (unlike V1's)
 * does not index the category name. So a query is resolved three ways at once:
 * the professional's name, their tagline, AND the category they trade in. That
 * last one is what connects the word a customer types to the taxonomy a
 * professional signed up under.
 *
 * FLAG: the durable fix is to add the category name to `search_vector` in a
 * migration (V1 indexed it). Until then this resolves it in the query, which is
 * correct and paginatable but does one extra category lookup per search.
 *
 * Every value that reaches a PostgREST filter is sanitised — commas, parens and
 * wildcards have meaning in the `.or()` grammar, so an unsanitised query is both
 * a breakage and an injection surface.
 */
import { createClient } from '@/lib/supabase/server'
import { CARD_COLUMNS, decorateCards, type CardRow } from '@/lib/marketplace/queries'
import type { ProfessionalCardData } from '@/lib/marketplace/professional-card'

export type SearchSort = 'relevance' | 'rating' | 'newest'

export type SearchParams = {
  q?: string
  category?: string
  area?: string
  sort?: SearchSort
  page?: number
}

export type SearchResult = {
  results: ProfessionalCardData[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

/**
 * Strips characters that carry meaning in a PostgREST `.or()` filter or an
 * `ilike` pattern. Leaves letters, numbers, spaces and a few safe punctuation
 * marks — anything a real business name or search term needs, and nothing that
 * can rewrite the filter.
 */
function sanitise(value: string): string {
  return value
    .replace(/[,()%_\\:*"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function searchProfessionals(params: SearchParams): Promise<SearchResult> {
  const supabase = await createClient()
  const page = Math.max(1, params.page ?? 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const sort = params.sort ?? 'relevance'
  const q = sanitise(params.q?.trim() ?? '')

  // Resolve an explicit category-slug filter to its id (the flat table stores
  // category_id). A slug that resolves to nothing must return nothing, not
  // widen the search.
  let categoryFilterId: string | null = null
  if (params.category) {
    const { data } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', params.category)
      .maybeSingle()
    if (!data) return empty(page)
    categoryFilterId = data.id
  }

  // Resolve the free-text query against category NAMES too, so "electrician"
  // finds everyone in the Electrician category even though no name contains the
  // word.
  let queryCategoryIds: string[] = []
  if (q.length >= 2) {
    const { data } = await supabase
      .from('categories')
      .select('id')
      .eq('is_active', true)
      .ilike('name', `%${q}%`)
      .limit(20)
    queryCategoryIds = (data ?? []).map((c) => c.id)
  }

  let builder = supabase
    .from('professional_profiles')
    .select(CARD_COLUMNS, { count: 'exact' })
    .eq('listing_status', 'active')

  if (categoryFilterId) builder = builder.eq('category_id', categoryFilterId)
  if (params.area) builder = builder.contains('service_areas', [sanitise(params.area)])

  if (q) {
    // name OR tagline OR (trades in a category whose name matched the query).
    const clauses = [`business_name.ilike.%${q}%`, `tagline.ilike.%${q}%`]
    if (queryCategoryIds.length > 0) {
      clauses.push(`category_id.in.(${queryCategoryIds.join(',')})`)
    }
    builder = builder.or(clauses.join(','))
  }

  // Ranking. Subscribed-first is FLAGGED — it needs the subscriptions LEFT JOIN
  // (S037/S131); until then the strongest reputation leads, which is the honest
  // proxy and matches V1's fallback ordering.
  if (sort === 'newest') {
    builder = builder.order('created_at', { ascending: false })
  } else {
    builder = builder
      .order('average_rating', { ascending: false, nullsFirst: false })
      .order('review_count', { ascending: false })
  }

  const { data, count, error } = await builder.range(from, to)
  if (error || !data) return empty(page)

  return {
    results: await decorateCards(supabase, data as unknown as CardRow[]),
    total: count ?? data.length,
    page,
    pageSize: PAGE_SIZE,
  }
}

function empty(page: number): SearchResult {
  return { results: [], total: 0, page, pageSize: PAGE_SIZE }
}

// ── Typeahead suggestions ────────────────────────────────────────────────────

export type Suggestion =
  | { kind: 'professional'; slug: string; name: string; category: string }
  | { kind: 'category'; slug: string; name: string }

/**
 * Lightweight suggestions for the search box: professionals by name, categories
 * by name — capped tight so the dropdown stays fast and scannable.
 */
export async function searchSuggestions(query: string): Promise<Suggestion[]> {
  const q = sanitise(query.trim())
  if (q.length < 2) return []

  const supabase = await createClient()

  const [pros, categories] = await Promise.all([
    supabase
      .from('professional_profiles')
      .select('slug, business_name, category_id')
      .eq('listing_status', 'active')
      .ilike('business_name', `%${q}%`)
      .limit(4),
    supabase
      .from('categories')
      .select('slug, name')
      .eq('is_active', true)
      .ilike('name', `%${q}%`)
      .limit(4),
  ])

  const categoryNames = new Map<string, string>()
  const proCategoryIds = [
    ...new Set((pros.data ?? []).map((p) => p.category_id).filter(Boolean)),
  ] as string[]
  if (proCategoryIds.length) {
    const { data } = await supabase.from('categories').select('id, name').in('id', proCategoryIds)
    for (const c of data ?? []) categoryNames.set(c.id, c.name)
  }

  const suggestions: Suggestion[] = []
  for (const pro of pros.data ?? []) {
    if (!pro.slug) continue
    suggestions.push({
      kind: 'professional',
      slug: pro.slug,
      name: pro.business_name,
      category: categoryNames.get(pro.category_id as string) ?? 'Professional',
    })
  }
  for (const cat of categories.data ?? []) {
    suggestions.push({ kind: 'category', slug: cat.slug, name: cat.name })
  }

  return suggestions
}
