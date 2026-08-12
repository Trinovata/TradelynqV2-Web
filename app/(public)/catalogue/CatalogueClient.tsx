'use client'

/**
 * Catalogue shell (playbook S086, spec v2/03 §3.6, copy deck §7.2/§7.4).
 * Filter chips (12 parents + All), the masonry grid (which owns its own
 * PostModal), and cursor-paginated Load more via the server action.
 *
 * Enquire routes to the storefront — the enquiry modal lives there with the
 * full gate gauntlet (S083); duplicating it here would fork the gate.
 * FLAG: PostModal Save (catalogue_saves API) is not wired — deferred with the
 * posting/upload flow to the storefront manager block (S113); the modal hides
 * its Save control when the handler is absent.
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CatalogueGrid, type CataloguePost } from '@/components/shared/CatalogueGrid'
import { EmptyState } from '@/components/ui/States'
import { SearchX } from 'lucide-react'
import { loadCataloguePage } from '@/lib/actions/catalogue'

type Props = {
  initialPosts: CataloguePost[]
  initialCursor: string | null
  categories: string[]
}

export function CatalogueClient({ initialPosts, initialCursor, categories }: Props) {
  const router = useRouter()
  const [posts, setPosts] = React.useState(initialPosts)
  const [cursor, setCursor] = React.useState(initialCursor)
  const [category, setCategory] = React.useState<string | null>(null)
  const [loading, startTransition] = React.useTransition()

  const applyFilter = (next: string | null) => {
    setCategory(next)
    startTransition(async () => {
      const page = await loadCataloguePage({ category: next ?? undefined })
      setPosts(page.posts)
      setCursor(page.nextCursor)
    })
  }

  const loadMore = () => {
    if (!cursor) return
    startTransition(async () => {
      const page = await loadCataloguePage({ cursor, category: category ?? undefined })
      setPosts((prev) => [...prev, ...page.posts])
      setCursor(page.nextCursor)
    })
  }

  const chipClass = (active: boolean) =>
    `inline-block whitespace-nowrap rounded border px-3 py-1.5 text-sm transition-colors ${
      active
        ? 'border-foreground text-foreground'
        : 'border-border text-body hover:border-foreground/40 hover:text-foreground'
    }`

  return (
    <div className="flex flex-col gap-6">
      <div
        className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        role="tablist"
        aria-label="Filter by category"
      >
        <div className="flex gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={category === null}
            className={chipClass(category === null)}
            onClick={() => applyFilter(null)}
          >
            All
          </button>
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={category === name}
              className={chipClass(category === name)}
              onClick={() => applyFilter(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {posts.length === 0 && !loading ? (
        <EmptyState
          icon={SearchX}
          heading={`No posts in ${category ?? 'the catalogue'} yet`}
          body="Try another category, or browse everything."
          action={{ label: 'Show all posts', onClick: () => applyFilter(null) }}
        />
      ) : (
        <CatalogueGrid
          posts={posts}
          onLoadMore={loadMore}
          hasMore={cursor !== null}
          loading={loading}
          onEnquire={(post) => router.push(`/professionals/${post.professional.slug}`)}
        />
      )}
    </div>
  )
}
