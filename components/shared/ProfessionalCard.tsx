'use client'

import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatTTD } from '@/lib/utils/format'
import { motion } from '@/lib/motion'
import type { ProfessionalCardData, ProfileViewSource } from '@/lib/marketplace/professional-card'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card, CardLink } from '@/components/ui/Card'
import { StarRating } from '@/components/ui/StarRating'

/**
 * ProfessionalCard — the consolidation keystone (playbook S074, spec `components-patterns.md` §1).
 *
 * One component for every place a professional is listed — search results, rails,
 * saved lists, admin previews — replacing V1's separate WorkerCard and
 * BusinessCard. The unified view-model is built once in `lib/marketplace`; this
 * component never touches a database row, so the same person renders identically
 * on every surface.
 *
 * Three decisions worth stating:
 *
 * 1. **One link role for the whole card.** The card surface is the link (via
 *    `CardLink`'s stretched pseudo-element), so a phone user taps anywhere rather
 *    than hunting a "View" button. Screen readers announce one link — the
 *    professional's name — not a card full of them.
 *
 * 2. **Sponsored is a label, never a layout.** A sponsored card is pixel-identical
 *    to an organic one plus a "Sponsored" tag (D39 honesty). Trust is the product;
 *    a paid placement that *looked* better would be selling ranking, which the
 *    platform does not do.
 *
 * 3. **The WhatsApp slot is a trigger here, not a live link.** The card's data is
 *    reveal-gated and carries no phone number, so the icon fires `onWhatsApp`
 *    (the caller navigates to the storefront / opens the enquiry, where the
 *    number is revealed) rather than constructing a `wa.me` link the card has no
 *    number for. See the flag in the S074 report.
 */

/** The public storefront path for a professional. */
function storefrontHref(slug: string): string {
  return `/professionals/${slug}`
}

/** First two areas, with a mono "+n" when there are more. */
function AreasLine({ areas }: { areas: string[] }) {
  if (areas.length === 0) return null
  const shown = areas.slice(0, 2)
  const extra = areas.length - shown.length

  return (
    <span className="text-muted truncate text-sm">
      {shown.join(', ')}
      {extra > 0 && <span className="font-mono tabular-nums"> +{extra}</span>}
    </span>
  )
}

/**
 * The identity badges: fully-verified shield, then the account track. Sole
 * traders carry no track badge — an unregistered professional is the baseline,
 * not a state to label.
 */
function IdentityBadges({ data }: { data: ProfessionalCardData }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {data.verification.fullyVerified && <Badge variant="verified">Verified</Badge>}
      {data.track === 'student' && <Badge variant="student">Student</Badge>}
      {data.track === 'registered' && <Badge variant="registered">Registered</Badge>}
    </div>
  )
}

/**
 * "Sponsored" tag — a warning-outline chip. The Badge closed union has no
 * `sponsored` variant, so the warning-outline styling is applied over the
 * primitive rather than by adding a variant to a file this task does not own.
 */
function SponsoredTag({ className }: { className?: string }) {
  return (
    <Badge className={cn('border-warning text-warning bg-transparent', className)}>Sponsored</Badge>
  )
}

/** The real rating once D40's threshold is met, or the "New" chip below it. */
function RatingOrNew({ data }: { data: ProfessionalCardData }) {
  if (data.rating) {
    return <StarRating value={data.rating.average} count={data.rating.count} size={16} />
  }
  return <Badge variant="neutral">New on TradeLynq</Badge>
}

/** `from TTD $200` — the price in mono, the framing word in body text. */
function FromPrice({ amount }: { amount: number }) {
  return (
    <span className="text-muted text-sm">
      from <span className="text-foreground font-mono tabular-nums">{formatTTD(amount)}</span>
    </span>
  )
}

/**
 * The WhatsApp icon affordance inside a card.
 *
 * Deliberately a `<button>`, not the WhatsAppButton link component: the card has
 * no reveal-gated phone number, so this fires the caller's `onWhatsApp` handler
 * (navigate to storefront / open enquiry) instead of a `wa.me` link. It stops
 * propagation so it does not also trigger the stretched card link, and sits above
 * that link's z-layer so the tap lands here.
 */
function WhatsAppSlot({ name, onWhatsApp }: { name: string; onWhatsApp: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Chat with ${name} on WhatsApp`}
      onClick={(event) => {
        event.stopPropagation()
        onWhatsApp()
      }}
      className={cn(
        'relative z-20 grid size-11 shrink-0 place-items-center',
        'border-border bg-card hover:bg-card-subtle rounded-[--radius-control] border',
        'transition-transform duration-75 ease-out active:scale-[0.98]',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'
      )}
    >
      <MessageCircle aria-hidden="true" className="text-whatsapp size-5 shrink-0" />
    </button>
  )
}

export type ProfessionalCardProps = {
  data: ProfessionalCardData
  /** grid = full card (default) · compact = 64px row (saved, admin) · rail = horizontal-scroll card. */
  variant?: 'grid' | 'compact' | 'rail'
  /** Analytics: rank in the list. Forwarded by the caller with `source`. */
  position?: number
  /** Where this view originated — forwarded to `profile_viewed` on click. */
  source: ProfileViewSource
  /** Present only when the reveal state allows a chat affordance on this surface. */
  onWhatsApp?: () => void
}

/**
 * A plain function component, not `forwardRef`: the underlying `Card` primitive
 * renders its own `<div>` and does not accept a ref, so there is no single DOM
 * root here to forward one to. Wrapping in an extra ref'd div would add a node
 * the layout does not want. Compose the ref at the primitive level if ever
 * needed.
 */
export function ProfessionalCard({
  data,
  variant = 'grid',
  position,
  source,
  onWhatsApp,
}: ProfessionalCardProps) {
  const href = storefrontHref(data.slug)
  // Forwarded to the analytics layer via data attributes — the card itself
  // stays presentational and emits no events (spec: analytics travels by prop).
  const analytics = {
    'data-profile-source': source,
    'data-profile-position': position,
  }

  // ── Compact: a single 64px row for saved lists and admin queues. ──────────
  if (variant === 'compact') {
    return (
      <Card
        interactive
        padding="compact"
        className="relative flex items-center gap-3"
        {...analytics}
      >
        <Avatar
          src={data.avatarUrl}
          alt={data.name}
          size={40}
          verified={data.verification.fullyVerified}
          className={motion('imageSettle')}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <CardLink href={href} className="text-foreground truncate text-sm font-medium">
            {data.name}
          </CardLink>
          <span className="text-muted truncate text-xs">
            {data.category.name}
            {data.areas[0] && ` · ${data.areas[0]}`}
          </span>
        </div>

        {data.sponsored && <SponsoredTag />}

        {data.rating ? (
          <StarRating value={data.rating.average} count={data.rating.count} size={16} />
        ) : (
          <Badge variant="neutral">New</Badge>
        )}

        {onWhatsApp && <WhatsAppSlot name={data.name} onWhatsApp={onWhatsApp} />}
      </Card>
    )
  }

  // ── Grid (default) and rail share one vertical layout; rail fixes its width
  //    so it can live inside an overflow-x scroll container. ──────────────────
  const isRail = variant === 'rail'

  return (
    <Card
      interactive
      className={cn('relative flex flex-col gap-3', isRail ? 'w-60 shrink-0' : 'w-full')}
      {...analytics}
    >
      {data.sponsored && <SponsoredTag className="absolute top-4 right-4 z-20" />}

      <div className="flex gap-4">
        <Avatar
          src={data.avatarUrl}
          alt={data.name}
          size={64}
          verified={data.verification.fullyVerified}
          className={motion('imageSettle')}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CardLink href={href} className="text-display-sm text-foreground truncate">
            {data.name}
          </CardLink>
          <div className="flex min-w-0 flex-col gap-1">
            <Badge variant="neutral" className="w-fit">
              {data.category.name}
            </Badge>
            <AreasLine areas={data.areas} />
          </div>
        </div>
      </div>

      <IdentityBadges data={data} />

      <RatingOrNew data={data} />

      {data.responseHint && <p className="text-muted text-sm">{data.responseHint}</p>}

      <div className="mt-1 flex items-center justify-between gap-2">
        {data.fromPriceTTD !== undefined ? (
          <FromPrice amount={data.fromPriceTTD} />
        ) : (
          <span aria-hidden="true" />
        )}
        {onWhatsApp && <WhatsAppSlot name={data.name} onWhatsApp={onWhatsApp} />}
      </div>
    </Card>
  )
}

/**
 * Exact-geometry skeleton for the grid variant (avatar circle + three lines +
 * action block). Re-exported from States so a caller imports the card and its
 * placeholder from one module.
 *
 * NOTE: this matches the GRID variant. Compact (64px row) and rail geometries
 * differ — flagged in the S074 report; a per-variant skeleton is a follow-up.
 */
export { ProfessionalCardSkeleton } from '@/components/ui/States'
