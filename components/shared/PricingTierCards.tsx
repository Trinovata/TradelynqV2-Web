'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatTTD } from '@/lib/utils/format'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import {
  CROSSOVER,
  PIONEER,
  RECOMMENDED_TIER,
  REGISTRATION_FEE,
  accountSurcharge,
  isPriceFrom,
  periodPerMonth,
  periodSavings,
  periodTotal,
  type AccountTrack,
  type BillingPeriodMonths,
  type Tier,
  type TierId,
} from '@/lib/constants/pricing'

/**
 * PricingTierCards (playbook S074, contract v2/details components-patterns §5).
 *
 * The crossover-aware pricing grid. Its one non-negotiable is the single-source
 * rule: every number it shows derives from `lib/constants/pricing.ts`, never a
 * literal. The S088 acceptance test is exactly that — change a value in the
 * constants and this page follows with zero copy edits — so a hardcoded price
 * here is a bug by definition. Prices flow through `formatTTD`; surcharge amounts
 * flow through `accountSurcharge()` rather than reading `CROSSOVER` fields raw,
 * so the account layer stays honest even if the function's logic changes.
 *
 * Three structural rules the spec fixes and this component enforces:
 *
 * 1. **One emphasis only.** The recommended tier (`RECOMMENDED_TIER` = Growth)
 *    gets `border-accent`, a raised card, and the "Most popular" badge. Nothing
 *    else on the grid competes — competing highlights emphasise nothing.
 *
 * 2. **Differences-only feature lists.** Each column past the first reads
 *    "Everything in {previous}, plus…" and lists only `tier.adds`. A full
 *    feature list repeated five times is unreadable, which is why `pricing.ts`
 *    stores deltas, not totals.
 *
 * 3. **The account layer is a line UNDER the cards, never inside them.** The
 *    Registered rate and the sole-trader crossover are one fact about the
 *    account, not five facts about five tiers — putting them in every card
 *    would imply they vary by tier, which they do not. Framed per D49: it is
 *    "the Registered rate", never a "surcharge".
 */

export type PricingTierCardsProps = {
  /** ALWAYS TIERS in TIER_ORDER from lib/constants/pricing.ts — never literals. */
  tiers: Tier[]
  accountTrack: AccountTrack
  /** Commit length (1/3/6/12) — prices derive via periodPerMonth/periodTotal. */
  periodMonths: BillingPeriodMonths
  /** Renders the Pioneer banner + a "3 months free" price line on every card. */
  pioneerActive: boolean
  /** `workspace` uses the amber `upgrade` CTA + marks the current tier; `public` uses primary. */
  context: 'public' | 'workspace'
  /** Workspace only: marks and locks the tier the professional is already on. */
  currentTier?: TierId
  onSelect: (tier: TierId) => void
}

export const PricingTierCards = React.forwardRef<HTMLDivElement, PricingTierCardsProps>(
  function PricingTierCards(
    { tiers, accountTrack, periodMonths, pioneerActive, context, currentTier, onSelect },
    ref
  ) {
    // Static data, but a misconfigured caller (or an empty filter) should not
    // render a bare grid of nothing.
    if (tiers.length === 0) {
      return (
        <div ref={ref}>
          <EmptyState
            heading="Plans are unavailable right now"
            body="We could not load the subscription plans. Refresh the page, or reach us on WhatsApp and we will sort it out."
          />
        </div>
      )
    }

    const currentIndex = currentTier ? tiers.findIndex((tier) => tier.id === currentTier) : -1

    return (
      <div ref={ref} className="flex flex-col gap-6">
        {pioneerActive && <PioneerBanner />}

        {/* Stacks at 375px; two-up on tablet; the full five-across only where
            there is genuine room for it. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {tiers.map((tier, index) => {
            const isRecommended = tier.id === RECOMMENDED_TIER
            const previous = index > 0 ? tiers[index - 1] : undefined

            return (
              <Card
                key={tier.id}
                elevation={isRecommended ? 'raised' : 'flat'}
                padding="default"
                className={cn(
                  'flex flex-col',
                  // The ONLY emphasis on the grid.
                  isRecommended && 'border-accent'
                )}
              >
                <CardHeader>
                  {isRecommended ? (
                    <Badge variant="active" className="self-start">
                      Most popular
                    </Badge>
                  ) : context === 'workspace' && tier.id === currentTier ? (
                    <Badge variant="complete" className="self-start">
                      Current plan
                    </Badge>
                  ) : null}
                  <CardTitle>{tier.name}</CardTitle>
                  <CardDescription>{tier.summary}</CardDescription>
                </CardHeader>

                <PriceBlock tier={tier} pioneerActive={pioneerActive} periodMonths={periodMonths} />

                <FeatureList
                  adds={tier.adds}
                  previousTierName={previous?.name}
                  className="mt-4 flex-1"
                />

                <TierCta
                  tier={tier}
                  context={context}
                  index={index}
                  currentIndex={currentIndex}
                  onSelect={onSelect}
                  className="mt-6"
                />
              </Card>
            )
          })}
        </div>

        <AccountLayer accountTrack={accountTrack} />
      </div>
    )
  }
)

/**
 * The Pioneer banner. Rendered as a bespoke accent strip rather than the neutral
 * `Banner` primitive for two reasons: Pioneer is the platform's one accent
 * moment (a subsidised launch cohort earns the colour), and the numeral law
 * requires the counts to render mono — a plain-string `Banner` cannot mark up
 * the numbers inside its text.
 */
function PioneerBanner() {
  return (
    <div
      role="status"
      className="border-accent/20 bg-accent-soft text-accent-ink flex flex-col gap-1 rounded-[--radius-card] border p-4"
    >
      <p className="text-foreground text-sm font-medium">
        Pioneer Programme — <span className="font-mono tabular-nums">{PIONEER.freeMonths}</span>{' '}
        months free
      </p>
      <p className="text-body text-sm text-pretty">
        The first <span className="font-mono tabular-nums">{PIONEER.totalCap}</span> professionals
        on TradeLynq get their plan free for{' '}
        <span className="font-mono tabular-nums">{PIONEER.freeMonths}</span> months. The one-time
        registration fee still applies.
      </p>
    </div>
  )
}

/**
 * The price line for one tier.
 *
 * Under Pioneer, the free offer is primary and the full price is struck — the
 * design law for any intro price. Enterprise is a floor (`isPriceFrom`), so its
 * number carries a trailing "+".
 */
function PriceBlock({
  tier,
  pioneerActive,
  periodMonths,
}: {
  tier: Tier
  pioneerActive: boolean
  periodMonths: BillingPeriodMonths
}) {
  const fromSuffix = isPriceFrom(tier.id) ? '+' : ''

  if (pioneerActive) {
    return (
      <div className="mt-4 flex flex-col gap-0.5">
        <p className="text-foreground text-display-sm">
          Free for <span className="font-mono tabular-nums">{PIONEER.freeMonths}</span> months
        </p>
        <p className="text-muted text-sm">
          then{' '}
          <span className="font-mono tabular-nums line-through">
            {formatTTD(tier.monthly)}
            {fromSuffix}
          </span>{' '}
          / month
        </p>
      </div>
    )
  }

  const perMonth = periodPerMonth(tier.id, periodMonths)
  const total = periodTotal(tier.id, periodMonths)
  const savings = periodSavings(tier.id, periodMonths)

  return (
    <div className="mt-4 flex flex-col gap-0.5">
      <p className="text-foreground text-display-sm">
        {/* The anchor: on any committed period the full monthly rate is struck
            beside the effective rate, so the saving is legible at a glance —
            never a raw discount percentage doing the persuading alone. */}
        {savings > 0 && (
          <span className="text-muted mr-2 font-mono text-base font-normal tabular-nums line-through">
            {formatTTD(tier.monthly)}
          </span>
        )}
        <span className="font-mono tabular-nums">
          {formatTTD(perMonth)}
          {fromSuffix}
        </span>
        <span className="text-muted text-base font-normal"> / month</span>
      </p>
      {periodMonths > 1 && (
        <p className="text-muted text-sm">
          Billed{' '}
          <span className="font-mono tabular-nums">
            {formatTTD(total)}
            {fromSuffix}
          </span>{' '}
          every <span className="font-mono tabular-nums">{periodMonths}</span> months
          {savings > 0 && (
            <>
              {' — '}
              <span className="text-success">
                save <span className="font-mono tabular-nums">{formatTTD(savings)}</span>
              </span>
            </>
          )}
        </p>
      )}
    </div>
  )
}

/** Differences-only feature list: "Everything in {previous}, plus…". */
function FeatureList({
  adds,
  previousTierName,
  className,
}: {
  adds: readonly string[]
  previousTierName?: string
  className?: string
}) {
  return (
    <div className={className}>
      {previousTierName && (
        <p className="text-body mb-2 text-sm font-medium">
          Everything in {previousTierName}, plus:
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {adds.map((feature) => (
          <li key={feature} className="text-body flex items-start gap-2 text-sm">
            <Check className="text-accent mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="text-pretty">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The per-tier CTA.
 *
 * `public` selects with the primary button. `workspace` marks the current tier
 * (disabled — you cannot "choose" the plan you are on) and pushes upgrades with
 * the amber `upgrade` variant, the platform's one reserved amber action.
 */
function TierCta({
  tier,
  context,
  index,
  currentIndex,
  onSelect,
  className,
}: {
  tier: Tier
  context: 'public' | 'workspace'
  index: number
  currentIndex: number
  onSelect: (tier: TierId) => void
  className?: string
}) {
  if (context === 'public') {
    return (
      <Button variant="primary" fullWidth onClick={() => onSelect(tier.id)} className={className}>
        {isPriceFrom(tier.id) ? 'Contact sales' : `Choose ${tier.name}`}
      </Button>
    )
  }

  const isCurrent = index === currentIndex
  const isUpgrade = currentIndex >= 0 && index > currentIndex

  if (isCurrent) {
    return (
      <Button variant="secondary" fullWidth disabled className={className}>
        Current plan
      </Button>
    )
  }

  return (
    <Button
      variant={isUpgrade ? 'upgrade' : 'secondary'}
      fullWidth
      onClick={() => onSelect(tier.id)}
      className={className}
    >
      {isUpgrade ? `Upgrade to ${tier.name}` : `Switch to ${tier.name}`}
    </Button>
  )
}

/**
 * The account layer — one line under the whole grid, because the Registered rate
 * is a fact about the account, not about any single tier. Amounts come through
 * `accountSurcharge()` so the framing and the numbers stay single-sourced.
 */
function AccountLayer({ accountTrack }: { accountTrack: AccountTrack }) {
  const registrationFee =
    accountTrack === 'student' ? REGISTRATION_FEE.student : REGISTRATION_FEE.standard

  return (
    <div className="border-border bg-card-subtle flex flex-col gap-2 rounded-[--radius-card] border p-4">
      <AccountRateLine accountTrack={accountTrack} />
      <p className="text-muted text-xs">
        A one-time <span className="font-mono tabular-nums">{formatTTD(registrationFee)}</span>{' '}
        registration fee applies.
      </p>
    </div>
  )
}

function AccountRateLine({ accountTrack }: { accountTrack: AccountTrack }) {
  if (accountTrack === 'registered') {
    const rate = accountSurcharge('registered', 0)
    return (
      <p className="text-body text-sm">
        + <span className="font-mono tabular-nums">{formatTTD(rate)}</span> / month — the Registered
        rate, locked permanently.
      </p>
    )
  }

  if (accountTrack === 'student') {
    // No verbatim deck line exists for the student account layer on the pricing
    // cards (spec §5 names only Registered and sole trader). Students pay the
    // Registered rate while studying, so the number is derived, not invented.
    const rate = accountSurcharge('student', 0)
    return (
      <p className="text-body text-sm">
        + <span className="font-mono tabular-nums">{formatTTD(rate)}</span> / month — the student
        rate while you study, matching the Registered rate.
      </p>
    )
  }

  // Sole trader: the crossover. Tier only for the grace window, then the
  // standard rate — with a register-to-lock path to the lower Registered rate.
  const standardRate = accountSurcharge('sole_trader', CROSSOVER.gracePaidMonths)
  const registeredRate = accountSurcharge('registered', 0)

  return (
    <p className="text-body text-sm text-pretty">
      Months <span className="font-mono tabular-nums">1</span>–
      <span className="font-mono tabular-nums">{CROSSOVER.gracePaidMonths}</span> your tier only,
      then + <span className="font-mono tabular-nums">{formatTTD(standardRate)}</span> / month.{' '}
      <Button variant="link" asChild>
        <a href="/for-professionals/register-your-business">
          Register your business to lock {formatTTD(registeredRate)} / month, permanently.
        </a>
      </Button>
    </p>
  )
}
