import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SearchX } from 'lucide-react'
import { getChildCategory, getProfessionalsByCategoryArea } from '@/lib/marketplace/seo'
import { AREA_BY_SLUG, areasNearby, slugifyArea } from '@/lib/constants/areas'
import { AREA_COPY } from '@/lib/copy/categories'
import { ProfessionalCard } from '@/components/shared/ProfessionalCard'
import { EmptyState } from '@/components/ui/States'

/**
 * Programmatic SEO page (playbook S087, spec v2/03 §3.7, copy §8.2):
 * "{Category} in {Area}", ~3,600 child-category × area combinations. ISR 1h.
 * Zero-count pages render the EmptyState AND go noindex — thin-content
 * protection; the page still works for a human who lands on it.
 *
 * Route shape note: /professionals/[slug] (storefront) owns depth 1;
 * this page owns depth 2. Next.js routes them by segment count.
 */
export const revalidate = 3600

type Params = { slug: string; area: string }

async function resolve(params: Params) {
  const category = await getChildCategory(params.slug)
  const area = AREA_BY_SLUG.get(params.area) ?? null
  return { category, area }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category, area } = await resolve(await params)
  if (!category || !area) return {}
  const professionals = await getProfessionalsByCategoryArea(category.id, area, 1)
  return {
    title: AREA_COPY.title(category.name, area),
    description: AREA_COPY.metaDescription(category.name, area),
    // Thin-content protection (§3.7): zero supply → noindex.
    robots: professionals.length === 0 ? { index: false, follow: true } : undefined,
  }
}

export default async function CategoryAreaPage({ params }: { params: Promise<Params> }) {
  const { category, area } = await resolve(await params)
  if (!category || !area) notFound()

  const professionals = await getProfessionalsByCategoryArea(category.id, area)
  const nearby = areasNearby(area)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-foreground font-display text-3xl tracking-tight text-balance">
          {AREA_COPY.h1(category.name, area)}
        </h1>
        {professionals.length > 0 && (
          <p className="text-muted mt-1 text-sm">
            <span className="font-mono tabular-nums">{professionals.length}</span>{' '}
            {AREA_COPY.countLine(professionals.length, area).replace(/^\d+\s/, '')}
          </p>
        )}
      </header>

      {professionals.length > 0 ? (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((pro, index) => (
            <li key={pro.id}>
              <ProfessionalCard data={pro} variant="grid" position={index + 1} source="category" />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={SearchX}
            heading={AREA_COPY.emptyHeading(category.name, area)}
            body={AREA_COPY.emptyBody}
            action={{
              label: AREA_COPY.emptyAction,
              href: `/search?q=${encodeURIComponent(category.name)}`,
            }}
          />
        </div>
      )}

      {nearby.length > 0 && (
        <section className="mt-12">
          <h2 className="text-foreground font-medium">{AREA_COPY.nearbyHeading}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {nearby.map((n) => (
              <li key={n}>
                <Link
                  href={`/professionals/${category.slug}/${slugifyArea(n)}`}
                  className="border-border text-body hover:border-foreground/40 hover:text-foreground inline-block rounded border px-3 py-1.5 text-sm transition-colors"
                >
                  {n}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
