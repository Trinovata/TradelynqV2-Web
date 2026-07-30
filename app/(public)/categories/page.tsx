import type { Metadata } from 'next'
import Link from 'next/link'
import { getCategoryTree } from '@/lib/marketplace/queries'

/**
 * Category index (playbook S087 companion). The footer and the catalogue's
 * low-supply degrade both link to /categories — a linked page must exist.
 * Twelve parent cards, each into its S087 landing page, children as a
 * text preview line.
 */
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Browse categories — Find professionals by service | TradeLynq',
  description:
    'Browse every service category on TradeLynq — from home repairs to beauty, events, tech, and more — and find verified professionals across Trinidad & Tobago.',
}

export default async function CategoriesIndexPage() {
  const tree = await getCategoryTree()

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-foreground font-display text-3xl tracking-tight">Browse categories</h1>
        <p className="text-body mt-1">Every service on TradeLynq, organised by trade.</p>
      </header>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tree.map((node) => (
          <li key={node.parent.slug}>
            <Link
              href={`/categories/${node.parent.slug}`}
              className="border-border bg-card hover:border-foreground/40 block h-full rounded-[--radius-card] border p-5 transition-colors"
            >
              <span className="text-foreground font-medium">{node.parent.name}</span>
              {node.children.length > 0 && (
                <span className="text-muted mt-1 block text-sm">
                  {node.children
                    .slice(0, 4)
                    .map((c) => c.name)
                    .join(' · ')}
                  {node.children.length > 4 ? ` +${node.children.length - 4}` : ''}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
