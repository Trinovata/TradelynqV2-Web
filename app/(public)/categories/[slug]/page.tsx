import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getParentCategory, getTopProfessionalsForParent } from '@/lib/marketplace/seo'
import { CATEGORY_COPY, CATEGORY_INTROS } from '@/lib/copy/categories'
import { ProfessionalCard } from '@/components/shared/ProfessionalCard'
import { Button } from '@/components/ui/Button'

/**
 * Parent-category landing page (playbook S087, spec v2/03 §3.7, copy §8.1/§8.3).
 * ISR 1h: supply changes hourly matter to a directory; nothing here is
 * per-viewer.
 *
 * FLAG (deck gap): §8.1's FAQ block (3 category-specific Q&As + FAQPage
 * schema) is omitted — the copy deck names it but writes no questions, and a
 * builder never invents deck-owned copy. Restore when the deck carries them.
 */
export const revalidate = 3600

type Params = { slug: string }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const parent = await getParentCategory(slug)
  if (!parent) return {}
  return {
    title: CATEGORY_COPY.title(parent.name),
    description: CATEGORY_COPY.metaDescription(parent.name),
  }
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const parent = await getParentCategory(slug)
  if (!parent) notFound()

  const professionals = await getTopProfessionalsForParent(parent)
  const intro = CATEGORY_INTROS[parent.slug]

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="max-w-3xl">
        <h1 className="text-foreground font-display text-3xl tracking-tight text-balance">
          {CATEGORY_COPY.h1(parent.name)}
        </h1>
        {intro && <p className="text-body mt-3 leading-relaxed text-pretty">{intro}</p>}
      </header>

      {parent.children.length > 0 && (
        <section className="mt-8">
          <h2 className="text-foreground font-medium">
            {CATEGORY_COPY.childChipsHeading(parent.name)}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {parent.children.map((child) => (
              <li key={child.slug}>
                <Link
                  href={`/search?category=${encodeURIComponent(child.slug)}`}
                  className="border-border text-body hover:border-foreground/40 hover:text-foreground inline-block rounded border px-3 py-1.5 text-sm transition-colors"
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {professionals.length > 0 && (
        <section className="mt-10">
          <h2 className="text-foreground font-medium">
            {CATEGORY_COPY.topProsHeading(parent.name)}
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {professionals.map((pro, index) => (
              <li key={pro.id}>
                <ProfessionalCard
                  data={pro}
                  variant="grid"
                  position={index + 1}
                  source="category"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-border bg-card mt-12 rounded-[--radius-card] border p-6 text-center sm:p-8">
        <h2 className="text-foreground font-display text-xl">
          {CATEGORY_COPY.ctaHeading(parent.name)}
        </h2>
        <div className="mt-4">
          <Button asChild>
            <Link href="/for-professionals">{CATEGORY_COPY.ctaButton}</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
