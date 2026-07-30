/**
 * Catalogue reads (playbook S086, spec v2/03 §3.6, copy deck §7).
 *
 * Server-only. Anon-safe by explicit column list — the anon grant on
 * catalogue_posts withholds posted_by (a scraper-join vector), and this module
 * selects only what anon may see so signed-in reads leak nothing extra.
 * FLAG (S150 security sweep): `authenticated` still holds table-wide SELECT on
 * catalogue_posts (20260719000019), exposing posted_by to any signed-in JWT —
 * the same grant class 20260724000001 closed on professional_profiles.
 *
 * Cursor pagination: (created_at, id) descending — a created_at tie cannot
 * skip or duplicate a post across pages, and the cursor is opaque to the
 * client.
 */
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { CataloguePost } from '@/components/shared/CatalogueGrid'

const POST_COLUMNS =
  'id, professional_id, image_urls, primary_image, caption, category, save_count, created_at'

export const CATALOGUE_PAGE_SIZE = 24

/** The low-supply threshold (§3.6): under this, render categories instead. */
export const CATALOGUE_MIN_SUPPLY = 12

export type CataloguePage = {
  posts: CataloguePost[]
  /** Pass back as `cursor` for the next page; null = end of feed. */
  nextCursor: string | null
  /** Total approved posts — drives the low-supply degrade. */
  total: number
}

type PostRow = {
  id: string
  professional_id: string
  image_urls: string[]
  primary_image: string | null
  caption: string | null
  category: string | null
  save_count: number
  created_at: string
}

export function encodeCursor(row: PostRow): string {
  return Buffer.from(`${row.created_at}|${row.id}`).toString('base64url')
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Offset forms Postgres actually emits: none, 'Z', '+00', '+00:00', '-0400'.
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}(:?\d{2})?|Z)?$/

/**
 * The cursor round-trips through the client, and its parts are interpolated
 * into a PostgREST `.or()` filter string — the exact injection class V1 was
 * bitten by (see lib/utils/sanitise-filter.ts in V1). Both parts are therefore
 * validated against strict shapes, not merely split: anything that is not a
 * UUID + ISO timestamp is treated as no cursor at all.
 */
export function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const [createdAt, id] = Buffer.from(cursor, 'base64url').toString().split('|')
    if (!createdAt || !id) return null
    if (!UUID_RE.test(id) || !ISO_TS_RE.test(createdAt)) return null
    return { createdAt, id }
  } catch {
    return null
  }
}

export async function getCataloguePage(options?: {
  cursor?: string
  category?: string
}): Promise<CataloguePage> {
  const supabase = await createClient()

  let countQuery = supabase
    .from('catalogue_posts')
    .select('id', { count: 'exact', head: true })
    .eq('is_approved', true)
  if (options?.category) countQuery = countQuery.eq('category', options.category)

  let postQuery = supabase
    .from('catalogue_posts')
    .select(POST_COLUMNS)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(CATALOGUE_PAGE_SIZE + 1)
  if (options?.category) postQuery = postQuery.eq('category', options.category)

  const decoded = options?.cursor ? decodeCursor(options.cursor) : null
  if (decoded) {
    // Strictly after the cursor position in (created_at, id) descending order.
    postQuery = postQuery.or(
      `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`
    )
  }

  const [{ count }, { data: rows, error }] = await Promise.all([countQuery, postQuery])
  if (error || !rows) return { posts: [], nextCursor: null, total: count ?? 0 }

  const page = rows.slice(0, CATALOGUE_PAGE_SIZE) as unknown as PostRow[]
  const hasMore = rows.length > CATALOGUE_PAGE_SIZE

  // Attribution in one batch, through the public card columns only.
  const professionalIds = [...new Set(page.map((r) => r.professional_id))]
  const { data: pros } = professionalIds.length
    ? await supabase
        .from('professional_profiles')
        .select('id, slug, business_name, profile_photo_url')
        .in('id', professionalIds)
        .eq('listing_status', 'active')
    : { data: [] }
  const proById = new Map((pros ?? []).map((p) => [p.id, p]))

  const posts: CataloguePost[] = page.flatMap((row) => {
    const pro = proById.get(row.professional_id)
    // A post whose professional is no longer active drops out silently — the
    // same no-status-leakage rule the storefront applies.
    if (!pro?.slug) return []
    return [
      {
        id: row.id,
        primaryImage: row.primary_image ?? row.image_urls[0] ?? '',
        imageUrls: row.image_urls,
        caption: row.caption ?? undefined,
        professional: {
          slug: pro.slug,
          name: pro.business_name,
          avatarUrl: pro.profile_photo_url ?? undefined,
        },
        saveCount: row.save_count,
        category: row.category ?? undefined,
      },
    ]
  })

  const last = page[page.length - 1]
  return {
    posts,
    nextCursor: hasMore && last ? encodeCursor(last) : null,
    total: count ?? posts.length,
  }
}
