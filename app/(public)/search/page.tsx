/**
 * Search results (playbook S079, spec v2/03 §3.3).
 *
 * Server component: it reads the URL (the single source of truth for search
 * state, so a shared link or a back-button restores exactly what you saw) and
 * runs the search on the server, so the first paint is results, not a spinner.
 * The interactive shell — the search box, filters, and the live result grid —
 * is the client island `SearchClient`.
 */
import type { Metadata } from 'next'
import { searchProfessionals, type SearchSort } from '@/lib/actions/search'
import { getCategoryTree } from '@/lib/marketplace/queries'
import { SearchClient } from './SearchClient'

type SearchParamsShape = {
  q?: string
  category?: string
  area?: string
  sort?: string
  page?: string
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParamsShape>
}): Promise<Metadata> {
  const sp = await searchParams
  const q = sp.q?.trim()
  const title = q
    ? `${q} — professionals in Trinidad & Tobago`
    : 'Browse professionals in Trinidad & Tobago'
  return { title, description: 'Find and compare verified professionals across Trinidad & Tobago.' }
}

const SORTS: SearchSort[] = ['relevance', 'rating', 'newest']

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsShape>
}) {
  const sp = await searchParams
  const sort = (SORTS.includes(sp.sort as SearchSort) ? sp.sort : 'relevance') as SearchSort
  const page = Math.max(1, Number(sp.page) || 1)

  const [result, categories] = await Promise.all([
    searchProfessionals({ q: sp.q, category: sp.category, area: sp.area, sort, page }),
    getCategoryTree(),
  ])

  return (
    <SearchClient
      initialResult={result}
      query={sp.q ?? ''}
      category={sp.category ?? ''}
      area={sp.area ?? ''}
      sort={sort}
      categories={categories.map((c) => ({ slug: c.parent.slug, name: c.parent.name }))}
    />
  )
}
