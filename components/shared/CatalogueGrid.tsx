'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, Flag, Heart, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { InfiniteList } from '@/components/ui/Pagination'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { toast } from '@/components/ui/Toast'

/**
 * CatalogueGrid + PostModal (playbook S074, contract v2/details/components-patterns.md §10).
 *
 * The catalogue is the marketplace's shop window — a Pinterest-style masonry of
 * work professionals have posted. Two rules from the spec shape the whole thing:
 *
 * 1. **Zero CLS on image load (M16 blur-up).** Masonry tiles have varying
 *    heights, so each tile reserves its aspect ratio *before* the image loads
 *    and the image settles in with a blur-up. Reserving nothing and letting the
 *    image size the tile is what makes a masonry grid reflow three times as it
 *    fills — the exact jank the design law forbids.
 *
 * 2. **Every post has an Enquire button (feed-readiness, chapter 16 §16.3).**
 *    The catalogue is the seed of the future community feed, and the invariant
 *    that keeps it a *marketplace* feed rather than a vanity gallery is that any
 *    post can be turned into a conversation. Enquire is not optional furniture.
 *
 * The GlidingGallery's ambient drift is gone (D6) — motion here is load-in and
 * interaction only, never decorative movement.
 *
 * ## The data shape is provisional
 *
 * `CataloguePost` below is modelled loosely on the `catalogue_posts` table. The
 * authoritative shape is `api-commerce-public.md §5`, which is not built yet;
 * reconcile the two when that route lands (notably `aspectRatio`, added here so
 * the masonry can reserve height — see the FLAG in the S074 report).
 */

export type CataloguePost = {
  id: string
  /** The tile/hero image. */
  primaryImage: string
  /** Full set for the modal carousel; usually includes `primaryImage` first. */
  imageUrls: string[]
  caption?: string
  professional: {
    slug: string
    name: string
    avatarUrl?: string
  }
  /** Shown in mono. Optimistically incremented on save. */
  saveCount: number
  category?: string
  /**
   * Width ÷ height of `primaryImage`. Not in the spec's field list — added so a
   * masonry tile can reserve its exact height and load with zero CLS. Defaults
   * to a portrait 4:5 when the API cannot supply it. RECONCILE with §5.
   */
  aspectRatio?: number
}

/** Fallback tile ratio when a post carries no dimensions — portrait reads best. */
const DEFAULT_ASPECT = 4 / 5

// The contract fixes columns to exactly { base: 2, md: 3, lg: 4 }, so the
// column classes are static — Tailwind cannot see runtime-built class strings,
// and the literal type means no other values are reachable anyway.
const MASONRY_COLUMNS = 'columns-2 gap-3 md:columns-3 md:gap-4 lg:columns-4'

export type CatalogueGridProps = {
  posts: CataloguePost[]
  onLoadMore: () => void
  hasMore: boolean
  loading: boolean
  /** Fixed by the contract; accepted for parity, the layout is static (see note). */
  columns?: { base: 2; md: 3; lg: 4 }
  /**
   * Extensions (not in the §10 grid contract) that wire the grid's internal
   * PostModal without the grid ever touching the data layer. Each is forwarded
   * to the modal for the currently-open post. FLAGGED in the S074 report.
   */
  onEnquire?: (post: CataloguePost) => void
  onSave?: (post: CataloguePost) => void
  onReport?: (post: CataloguePost) => void
  className?: string
}

/**
 * A single masonry tile. Owns its own blur-up state so one slow image does not
 * hold up the others, and reserves height up front from the post's aspect ratio.
 */
function PostTile({ post, onOpen }: { post: CataloguePost; onOpen: () => void }) {
  const [loaded, setLoaded] = React.useState(false)

  return (
    <button
      type="button"
      onClick={onOpen}
      // break-inside-avoid keeps a tile from splitting across two columns.
      className={cn(
        'group mb-3 block w-full break-inside-avoid overflow-hidden text-left md:mb-4',
        'border-border bg-card-subtle rounded-[--radius-card] border',
        'transition-transform duration-75 ease-out active:scale-[0.99]',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'
      )}
      aria-label={
        post.caption
          ? `${post.caption} — by ${post.professional.name}`
          : `Post by ${post.professional.name}`
      }
    >
      {/* Reserved box: the aspect ratio holds the space so the load is CLS-free. */}
      <div style={{ aspectRatio: post.aspectRatio ?? DEFAULT_ASPECT }} className="relative w-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- user upload URLs are arbitrary; next/image remote config cannot enumerate them */}
        <img
          src={post.primaryImage}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          // M16 imageSettle: blur + slight scale until decoded, then settles.
          className={cn(
            'size-full object-cover',
            'transition-[filter,transform] duration-300 ease-out',
            loaded ? 'blur-0 scale-100' : 'scale-[1.02] blur-md'
          )}
        />
      </div>

      {post.caption && (
        <p className="text-body line-clamp-2 px-2.5 py-2 text-sm text-pretty">{post.caption}</p>
      )}
    </button>
  )
}

/** Skeleton masonry — varied heights so it mirrors real content, not a grid. */
function CatalogueGridSkeleton() {
  // Deterministic ratios (no Math.random → no hydration mismatch).
  const ratios = [0.7, 1.1, 0.85, 1.3, 0.9, 1.0, 1.2, 0.75]
  return (
    <div className={MASONRY_COLUMNS} aria-hidden="true">
      {ratios.map((ratio, index) => (
        <Skeleton
          key={index}
          className="mb-3 w-full break-inside-avoid rounded-[--radius-card] md:mb-4"
          style={{ aspectRatio: ratio }}
        />
      ))}
    </div>
  )
}

export function CatalogueGrid({
  posts,
  onLoadMore,
  hasMore,
  loading,
  onEnquire,
  onSave,
  onReport,
  className,
}: CatalogueGridProps) {
  const [openPost, setOpenPost] = React.useState<CataloguePost | null>(null)

  // First load, nothing yet: skeleton masonry in the real geometry.
  if (loading && posts.length === 0) {
    return (
      <div className={className}>
        <CatalogueGridSkeleton />
      </div>
    )
  }

  // Settled and empty: a way-forward message, never a blank grid.
  if (!loading && posts.length === 0) {
    return (
      <EmptyState
        className={className}
        heading="No work posted here yet"
        body="As professionals share their jobs, their photos will appear here. Check back soon, or browse the directory."
        action={{ label: 'Browse professionals', href: '/professionals' }}
      />
    )
  }

  return (
    <div className={className}>
      <InfiniteList
        onLoadMore={onLoadMore}
        loading={loading}
        hasMore={hasMore}
        loadMoreLabel="Load more posts"
        endMessage="You have reached the end of the catalogue."
      >
        <div className={MASONRY_COLUMNS}>
          {posts.map((post) => (
            <PostTile key={post.id} post={post} onOpen={() => setOpenPost(post)} />
          ))}
        </div>
      </InfiniteList>

      {openPost && (
        <PostModal
          // Keyed by post id so opening a different post mounts a fresh modal —
          // the carousel resets to the first image without a setState-in-effect.
          key={openPost.id}
          post={openPost}
          open={openPost !== null}
          onOpenChange={(next) => {
            if (!next) setOpenPost(null)
          }}
          onEnquire={() => onEnquire?.(openPost)}
          onSave={onSave ? () => onSave(openPost) : undefined}
          onReport={onReport ? () => onReport(openPost) : undefined}
        />
      )}
    </div>
  )
}

export type PostModalProps = {
  post: CataloguePost
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Auth-gated upstream. Optional; the Save control hides when not provided. */
  onSave?: () => void
  /** Feed-readiness rule — Enquire is on every post, so this is required. */
  onEnquire: () => void
  /**
   * Overflow "Report" action. Extension beyond the §10 modal contract; when
   * omitted the report item falls back to a local acknowledgement toast.
   */
  onReport?: () => void
}

/**
 * The expanded post. A carousel of the work, the professional's attribution
 * (linking to their storefront), an optimistic Save, an overflow Report, and the
 * Enquire CTA that turns the post into a conversation.
 */
export function PostModal({
  post,
  open,
  onOpenChange,
  onSave,
  onEnquire,
  onReport,
}: PostModalProps) {
  const images = post.imageUrls.length > 0 ? post.imageUrls : [post.primaryImage]
  const [index, setIndex] = React.useState(0)
  const [saved, setSaved] = React.useState(false)
  const [overflowOpen, setOverflowOpen] = React.useState(false)

  // No reset effect: consumers that keep this component mounted across posts
  // should key it by `post.id` (CatalogueGrid does), which remounts it fresh.

  const multiple = images.length > 1
  const go = React.useCallback(
    (delta: number) => {
      setIndex((current) => (current + delta + images.length) % images.length)
    },
    [images.length]
  )

  // Optimistic save (M9): flip local state immediately, tell the page after.
  // The page owns persistence and reconciles on failure.
  const saveCount = post.saveCount + (saved ? 1 : 0)
  const handleSave = () => {
    setSaved((prev) => !prev)
    onSave?.()
  }

  const handleReport = () => {
    setOverflowOpen(false)
    if (onReport) onReport()
    else toast('Thanks — our team will review this post.', { kind: 'info' })
  }

  // Swipe (nice-to-have): a horizontal drag past the threshold changes slide.
  const dragStart = React.useRef<number | null>(null)
  const SWIPE_THRESHOLD = 48

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={post.caption ?? `Work by ${post.professional.name}`}
      description={post.category ? `Posted in ${post.category}` : undefined}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {onSave ? (
            <Button
              variant="secondary"
              onClick={handleSave}
              aria-pressed={saved}
              iconLeft={
                <Heart
                  aria-hidden="true"
                  // M9 morph in place: fill toggles, no layout change.
                  className={cn(
                    'transition-transform duration-150 ease-in-out',
                    saved && 'scale-110 fill-current'
                  )}
                />
              }
            >
              {saved ? 'Saved' : 'Save'}
              <span className="ml-1 font-mono tabular-nums">
                {saveCount.toLocaleString('en-TT')}
              </span>
            </Button>
          ) : (
            <span />
          )}

          <Button variant="primary" onClick={onEnquire}>
            Enquire
          </Button>
        </div>
      }
    >
      {/* ── Carousel ─────────────────────────────────────────────────────── */}
      <div
        className="border-border bg-card-subtle relative overflow-hidden rounded-[--radius-card] border"
        onPointerDown={(event) => {
          dragStart.current = event.clientX
        }}
        onPointerUp={(event) => {
          if (dragStart.current === null) return
          const dx = event.clientX - dragStart.current
          dragStart.current = null
          if (!multiple || Math.abs(dx) < SWIPE_THRESHOLD) return
          go(dx < 0 ? 1 : -1)
        }}
      >
        {/* Reserved 4:3 viewport keeps the modal height stable across slides. */}
        <div className="relative aspect-[4/3] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- user upload URLs are arbitrary; next/image remote config cannot enumerate them */}
          <img
            key={images[index]}
            src={images[index]}
            alt={
              post.caption
                ? `${post.caption} (${index + 1} of ${images.length})`
                : `Work by ${post.professional.name} (${index + 1} of ${images.length})`
            }
            className="size-full object-contain"
            decoding="async"
          />
        </div>

        {multiple && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className={cn(
                'absolute top-1/2 left-2 grid size-11 -translate-y-1/2 place-items-center',
                'border-border bg-background/85 text-body rounded-full border backdrop-blur-sm',
                'transition-transform duration-75 ease-out active:scale-[0.98]',
                'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'
              )}
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className={cn(
                'absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center',
                'border-border bg-background/85 text-body rounded-full border backdrop-blur-sm',
                'transition-transform duration-75 ease-out active:scale-[0.98]',
                'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'
              )}
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>

            <div
              className="bg-background/85 text-muted absolute right-2 bottom-2 rounded-[--radius-tag] px-1.5 py-0.5 font-mono text-xs tabular-nums backdrop-blur-sm"
              aria-hidden="true"
            >
              {index + 1}/{images.length}
            </div>
          </>
        )}
      </div>

      {/* ── Professional attribution + overflow ─────────────────────────── */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <a
          href={`/professionals/${post.professional.slug}`}
          className={cn(
            'flex min-w-0 items-center gap-3 rounded-[--radius-control] p-1',
            'transition-transform duration-75 ease-out active:scale-[0.99]',
            'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'
          )}
        >
          <Avatar src={post.professional.avatarUrl} alt={post.professional.name} size={40} />
          <span className="min-w-0">
            <span className="text-foreground block truncate text-sm font-medium">
              {post.professional.name}
            </span>
            <span className="text-muted block text-xs">View storefront</span>
          </span>
        </a>

        {/* Overflow: a lightweight menu rather than a bare Report button, so a
            destructive-ish action is one deliberate step away, not a mis-tap. */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOverflowOpen((prev) => !prev)}
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            className={cn(
              'text-muted grid size-11 place-items-center rounded-[--radius-control]',
              'hover:bg-card-subtle hover:text-foreground',
              'transition-transform duration-75 ease-out active:scale-[0.98]',
              'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'
            )}
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
          </button>

          {overflowOpen && (
            <div
              role="menu"
              className={cn(
                'absolute right-0 z-10 mt-1 min-w-40 overflow-hidden',
                'border-border bg-card rounded-[--radius-control] border shadow-lg',
                // M4 fadeSlideIn.
                'transition-[opacity,transform] duration-150 ease-out'
              )}
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleReport}
                className={cn(
                  'text-body flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm',
                  'hover:bg-card-subtle',
                  'focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2'
                )}
              >
                <Flag className="size-4 shrink-0" aria-hidden="true" />
                Report this post
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
