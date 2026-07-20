'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'
import { formatTTD } from '@/lib/utils/format'
import { PIONEER, REGISTRATION_FEE } from '@/lib/constants/pricing'

/**
 * AdSlot (playbook S074, contract v2/details/components-patterns.md §11, spec v2/14 §14.2).
 *
 * Three rules the design law puts on this component, each of which the old
 * V1 AdPlaceholder broke:
 *
 * 1. **Space is reserved ALWAYS, before anything loads — zero CLS.** Each zone
 *    has a fixed aspect ratio (below), applied to the root whether the slot
 *    ends up showing a paid campaign, a house ad, or nothing. An ad that pushes
 *    the page down when it arrives is the single most disruptive layout shift a
 *    marketplace ships, because it lands exactly as the reader starts reading.
 *
 * 2. **A "Sponsored" label rides every paid campaign.** Not a style choice —
 *    it is the line between advertising and editorial, and trust is the product.
 *    House ads (our own promos) carry no such label; they are not sold.
 *
 * 3. **No campaign is never an empty grey box.** When nothing is sold for this
 *    slot we rotate a house ad (Pioneer / registration / merch). A blank slot
 *    reads as a broken page; a house promo turns unsold inventory into a nudge.
 *
 * ## The component is a pure surface — it touches no data layer
 *
 * Selection (which campaign, the kill-switch, the RPC that counts impressions,
 * the tracked click redirect) is the page's job. This component is handed the
 * campaign to render and two callbacks. It owns exactly one piece of behaviour
 * the page cannot: the *client-side* impression rule — a campaign counts only
 * once it has been at least half on screen for a full second. That measurement
 * has to happen where the pixels are, so it lives here and reports out through
 * `onImpression`. (V1 counted impressions at selection time, i.e. for ads the
 * user never scrolled to; moving the count client-side is the §11 delta.)
 */

/**
 * Fixed aspect ratio per zone (spec §14.2). Chosen so the reserved box matches
 * the creative dimensions the sales deck sells against, and so each zone reads
 * as the shape its surrounding layout expects:
 *
 * - `home`            wide hero banner across the feed          → 16:5
 * - `search`          slim in-list card between result rows     → 4:1
 * - `category`        wide banner atop a category listing       → 16:5
 * - `storefront_related`  square-ish related-products card      → 4:3
 * - `pro_workspace`   tall sidebar unit in the pro dashboard    → 3:4
 */
const ZONE_ASPECT: Record<AdZone, string> = {
  home: 'aspect-[16/5]',
  search: 'aspect-[4/1]',
  category: 'aspect-[16/5]',
  storefront_related: 'aspect-[4/3]',
  pro_workspace: 'aspect-[3/4]',
}

/** How long a slot must stay ≥50% visible before the impression counts. */
const IMPRESSION_DWELL_MS = 1000
/** Half on screen — the industry-standard viewability floor. */
const IMPRESSION_VISIBILITY = 0.5

export type AdZone = 'home' | 'search' | 'category' | 'storefront_related' | 'pro_workspace'

export type AdCampaign = {
  id: string
  /** Creative image URL. Rendered object-cover into the zone's reserved box. */
  creativeUrl: string
  /** Where a click sends the user. The page turns this into a tracked redirect. */
  linkUrl: string
  /** Advertiser name — the accessible label and the "Sponsored by" attribution. */
  companyName: string
}

export type AdSlotProps = {
  zone: AdZone
  /** Targeting hints the page used to select the campaign; surfaced for context. */
  context?: { category?: string; area?: string }
  /**
   * The campaign to render, already selected upstream. `null` (nothing sold for
   * this slot) renders a house ad rather than an empty box.
   */
  campaign?: AdCampaign | null
  /** The per-zone kill-switch, read upstream. When true the slot renders nothing. */
  killed?: boolean
  /**
   * Fired once, when the slot has been ≥50% visible for 1s. The page wires this
   * to the impression RPC and the `ad_impression` event. Never called for house ads.
   */
  onImpression?: (campaignId: string) => void
  /**
   * Fired on click of a paid campaign. The page wires this to `ad_click` and the
   * tracked redirect. Not called for house ads — those navigate directly.
   */
  onClick?: (campaignId: string) => void
  className?: string
}

/**
 * Reports an impression once the element has been at least half visible for a
 * continuous second. Leaving the viewport before the second is up cancels the
 * pending count; the impression only ever fires once per mount.
 */
function useImpression(
  ref: React.RefObject<HTMLElement | null>,
  campaignId: string | undefined,
  onImpression: ((campaignId: string) => void) | undefined
): void {
  React.useEffect(() => {
    const node = ref.current
    // No campaign → nothing to count (house ads are not measured).
    if (!node || !campaignId || !onImpression) return

    let fired = false
    let dwellTimer: ReturnType<typeof setTimeout> | undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting && entry.intersectionRatio >= IMPRESSION_VISIBILITY) {
          if (fired || dwellTimer) return
          dwellTimer = setTimeout(() => {
            fired = true
            onImpression(campaignId)
            observer.disconnect()
          }, IMPRESSION_DWELL_MS)
        } else if (dwellTimer) {
          // Scrolled away before the dwell completed — reset and wait again.
          clearTimeout(dwellTimer)
          dwellTimer = undefined
        }
      },
      { threshold: IMPRESSION_VISIBILITY }
    )

    observer.observe(node)
    return () => {
      if (dwellTimer) clearTimeout(dwellTimer)
      observer.disconnect()
    }
  }, [ref, campaignId, onImpression])
}

/**
 * The house-ad rotation shown when no campaign is sold for a slot. Deterministic
 * per zone so server and client render the same promo — a random pick would
 * hydrate mismatched. Each entry links somewhere useful rather than nowhere.
 */
type HouseAd = { eyebrow: string; heading: string; body: string; cta: string; href: string }

const ZONE_ORDER: AdZone[] = ['home', 'search', 'category', 'storefront_related', 'pro_workspace']

function houseAdFor(zone: AdZone): HouseAd {
  const rotation: HouseAd[] = [
    {
      eyebrow: 'Pioneer programme',
      heading: `${PIONEER.freeMonths} months free`,
      body: 'The first professionals on TradeLynq list free for a season. Places are limited.',
      cta: 'Claim a Pioneer place',
      href: '/pricing',
    },
    {
      eyebrow: 'Get listed',
      heading: 'Be found by customers',
      body: `Register your business today — a one-time ${formatTTD(REGISTRATION_FEE.standard)} fee gets you on the map.`,
      cta: 'Register your business',
      href: '/register',
    },
    {
      eyebrow: 'TradeLynq merch',
      heading: 'Look the part on the job',
      body: 'Branded shirts, decals and signage that tell customers you mean business.',
      cta: 'Visit the shop',
      href: '/shop',
    },
  ]
  // Stable index from the zone name — same promo every render for a given zone.
  const index = ZONE_ORDER.indexOf(zone) % rotation.length
  return rotation[index] ?? rotation[0]!
}

export const AdSlot = React.forwardRef<HTMLAnchorElement, AdSlotProps>(function AdSlot(
  { zone, context, campaign, killed = false, onImpression, onClick, className },
  forwardedRef
) {
  // The root is always an <a> (campaign or house ad), so both refs are anchors.
  const localRef = React.useRef<HTMLAnchorElement | null>(null)
  // Merge the forwarded ref with the local one the observer needs.
  const setRefs = React.useCallback(
    (node: HTMLAnchorElement | null) => {
      localRef.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef]
  )

  useImpression(localRef, campaign?.id, onImpression)

  // Kill-switch: render nothing. The surrounding layout should collapse the gap
  // — a killed slot is off, not empty.
  if (killed) return null

  const aspect = ZONE_ASPECT[zone]

  // ── Paid campaign ──────────────────────────────────────────────────────────
  if (campaign) {
    return (
      <a
        ref={setRefs}
        href={campaign.linkUrl}
        onClick={() => onClick?.(campaign.id)}
        data-ad-zone={zone}
        data-ad-category={context?.category}
        data-ad-area={context?.area}
        aria-label={`Sponsored: ${campaign.companyName}`}
        className={cn(
          'group relative block w-full overflow-hidden',
          'border-border bg-card-subtle rounded-[--radius-card] border',
          aspect,
          // M1 press only; the whole slot is the target.
          'transition-transform duration-75 ease-out active:scale-[0.99]',
          'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
          className
        )}
      >
        {/* Creative fills the reserved box; object-cover so any ratio crops
            cleanly rather than shifting the layout it was measured into. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- advertiser CDN URLs are arbitrary; next/image remote config cannot enumerate them */}
        <img
          src={campaign.creativeUrl}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          decoding="async"
        />

        {/* Always present on a paid campaign — the advertising/editorial line. */}
        <span
          className={cn(
            'absolute top-2 left-2 rounded-[--radius-tag] px-1.5 py-0.5',
            'bg-background/85 text-muted border-border border text-[10px] font-medium',
            'backdrop-blur-sm'
          )}
        >
          Sponsored
        </span>
      </a>
    )
  }

  // ── House ad (nothing sold) ─────────────────────────────────────────────────
  const house = houseAdFor(zone)
  return (
    <a
      ref={setRefs}
      href={house.href}
      data-ad-zone={zone}
      data-ad-house="true"
      className={cn(
        'group relative flex w-full flex-col justify-center overflow-hidden',
        'border-border bg-accent-soft rounded-[--radius-card] border p-4 text-center',
        aspect,
        'transition-transform duration-75 ease-out active:scale-[0.99]',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        className
      )}
    >
      <p className="text-accent-ink/80 text-[11px] font-medium tracking-wide uppercase">
        {house.eyebrow}
      </p>
      <p className="text-accent-ink mt-1 text-base font-semibold text-balance">{house.heading}</p>
      <p className="text-accent-ink/80 mt-1 line-clamp-2 text-sm text-pretty">{house.body}</p>
      <span className="text-accent-ink mt-2 text-sm font-medium underline-offset-4 group-hover:underline">
        {house.cta}
      </span>
    </a>
  )
})
