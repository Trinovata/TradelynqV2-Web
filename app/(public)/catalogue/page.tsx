import type { Metadata } from 'next'
import Link from 'next/link'
import { getCataloguePage, CATALOGUE_MIN_SUPPLY } from '@/lib/marketplace/catalogue'
import { getCategoryTree } from '@/lib/marketplace/queries'
import { CatalogueClient } from './CatalogueClient'
import { Button } from '@/components/ui/Button'

/**
 * Catalogue (playbook S086, spec v2/03 §3.6, copy deck §7).
 *
 * Real posts only — V1's Unsplash sample gallery is not carried (fake supply
 * is anti-trust). Under 12 total posts the whole gallery degrades to the
 * category grid + CTA (§7.4): a thin gallery advertises weakness, categories
 * advertise breadth.
 */
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Catalogue — See real work from T&T professionals | TradeLynq',
  description:
    'Browse a visual showcase of real projects from verified Trinidad & Tobago professionals. Find inspiration and go straight to the professional behind the work.',
}

export default async function CataloguePage() {
  const [page, tree] = await Promise.all([getCataloguePage(), getCategoryTree()])
  const parentNames = tree.map((node) => node.parent.name)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <h1 className="text-foreground font-display text-4xl tracking-tight">Catalogue</h1>
        <p className="text-body mt-1">Real work from real professionals across T&amp;T.</p>
      </header>

      {page.total < CATALOGUE_MIN_SUPPLY ? (
        <section className="py-6">
          <h2 className="text-foreground font-display text-xl">
            Discover professionals by category
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {tree.map((node) => (
              <li key={node.parent.slug}>
                <Link
                  href={`/categories/${node.parent.slug}`}
                  className="border-border bg-card text-foreground hover:border-foreground/40 block rounded-[--radius-card] border p-4 text-sm font-medium transition-colors"
                >
                  {node.parent.name}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Button asChild variant="secondary">
              <Link href="/categories">Browse categories</Link>
            </Button>
          </div>
        </section>
      ) : (
        <CatalogueClient
          initialPosts={page.posts}
          initialCursor={page.nextCursor}
          categories={parentNames}
        />
      )}
    </div>
  )
}
