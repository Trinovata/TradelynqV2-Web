'use client'

/**
 * Pricing — interactive card block (spec v2/03 §3.8).
 *
 * The one piece of the pricing page that has to run in the browser: the two
 * controls that reframe every price on the grid. An account-type segmented
 * control drives `PricingTierCards`' account layer (the Registered rate, per
 * D49 — never a "surcharge"), and a billing toggle switches monthly/annual.
 *
 * It holds NO prices. Every number the cards show flows from
 * `lib/constants/pricing.ts` through `PricingTierCards`, so the S088 acceptance
 * test holds: change a value in the constants and this page follows with zero
 * copy edits. Choosing a tier on a public page is a signup intent, so `onSelect`
 * routes to `/signup` carrying the chosen plan.
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { PricingTierCards } from '@/components/shared/PricingTierCards'
import { TIERS, TIER_ORDER, type AccountTrack, type TierId } from '@/lib/constants/pricing'

type BillingPeriod = 'monthly' | 'annual'

/**
 * Account-type options. Display strings are verbatim from copy-public.md §9.2;
 * each maps to an `AccountTrack`. Ordered along the platform's upgrade path
 * (§10.3): Student Entrepreneur → Small Business → Registered Business.
 */
const ACCOUNT_OPTIONS: ReadonlyArray<{ value: AccountTrack; label: string }> = [
  { value: 'student', label: 'Student Entrepreneur' },
  { value: 'sole_trader', label: 'Small Business' },
  { value: 'registered', label: 'Registered Business' },
]

const BILLING_OPTIONS: ReadonlyArray<{ value: BillingPeriod; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
]

export function PricingClient() {
  const router = useRouter()
  // Small Business (sole trader) is the core track most professionals arrive on.
  const [accountTrack, setAccountTrack] = React.useState<AccountTrack>('sole_trader')
  const [billingPeriod, setBillingPeriod] = React.useState<BillingPeriod>('monthly')

  const tiers = React.useMemo(() => TIER_ORDER.map((id) => TIERS[id]), [])

  const handleSelect = React.useCallback(
    (tier: TierId) => {
      // A chosen tier is a signup intent; carry it so onboarding can preselect.
      router.push(`/signup?role=worker&plan=${tier}`)
    },
    [router]
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <Segmented
          label="I’m signing up as a…"
          showLabel
          options={ACCOUNT_OPTIONS}
          value={accountTrack}
          onChange={setAccountTrack}
          className="w-full sm:w-fit"
        />
        <Segmented
          label="Billing period"
          options={BILLING_OPTIONS}
          value={billingPeriod}
          onChange={setBillingPeriod}
          size="compact"
          className="w-full sm:w-fit"
        />
      </div>

      <PricingTierCards
        tiers={tiers}
        accountTrack={accountTrack}
        billingPeriod={billingPeriod}
        pioneerActive={true}
        context="public"
        onSelect={handleSelect}
      />
    </div>
  )
}

/**
 * An accessible segmented control (radiogroup) with a sliding indicator.
 *
 * Roving tabindex plus Arrow-key navigation matches native radio semantics, so a
 * keyboard user cycles options without leaving the group. The indicator is the
 * only moving part and animates `transform` alone (the compositable property,
 * per the motion law), and only under `motion-safe` — a reduced-motion viewer
 * gets an instant, jank-free swap.
 */
function Segmented<T extends string>({
  label,
  showLabel = false,
  options,
  value,
  onChange,
  size = 'fluid',
  className,
}: {
  /** Accessible name for the group. Shown when `showLabel`, else screen-reader only. */
  label: string
  showLabel?: boolean
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  size?: 'fluid' | 'compact'
  className?: string
}) {
  const labelId = React.useId()
  const buttonRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const count = options.length
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )

  const moveFocus = React.useCallback(
    (from: number, delta: number) => {
      const next = (from + delta + count) % count
      const option = options[next]
      if (!option) return
      onChange(option.value)
      buttonRefs.current[next]?.focus()
    },
    [count, onChange, options]
  )

  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      moveFocus(index, 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(index, -1)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className={cn('text-muted text-xs font-medium', !showLabel && 'sr-only')}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={cn(
          'border-border bg-card-subtle relative flex rounded-full border p-1',
          className
        )}
      >
        {/* The one moving part. Width is fixed per segment; only transform animates. */}
        <span
          aria-hidden="true"
          className="bg-card pointer-events-none absolute top-1 bottom-1 left-1 rounded-full shadow-sm motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out"
          style={{
            width: `calc((100% - 0.5rem) / ${count})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
        {options.map((option, index) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              ref={(element) => {
                buttonRefs.current[index] = element
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                'relative z-10 flex min-h-9 flex-1 items-center justify-center rounded-full text-center leading-tight whitespace-normal transition-[color] duration-150',
                'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                selected ? 'text-foreground font-medium' : 'text-muted hover:text-body',
                size === 'fluid' ? 'px-2 py-1.5 text-xs sm:px-4 sm:text-sm' : 'px-5 py-1.5 text-sm'
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
