/**
 * Pricing page (playbook S088, spec v2/03 §3.8).
 *
 * Server component: metadata and the surrounding prose render here; the one
 * interactive island is `PricingClient` (the account-type and billing controls
 * plus `PricingTierCards`). The chapter's acceptance test is single-sourcing —
 * "numbers rendered exclusively from lib/constants/pricing.ts (a price change is
 * a one-file change)" — so this file hardcodes NO money. Every figure below is
 * derived from `PIONEER`, `REGISTRATION_FEE`, and the tier table, and the tier
 * prices themselves live inside the client card block.
 *
 * The FAQ answers included here are the price-free questions from copy-public.md
 * §9.9, quoted verbatim; the registration fee and the Registered rate are the
 * two facts that carry numbers, so they are stated from the constants rather
 * than duplicated as prose that could drift.
 */
import type { Metadata } from 'next'
import { formatTTD, formatDate } from '@/lib/utils/format'
import { PIONEER, REGISTRATION_FEE, TIERS, TIER_ORDER } from '@/lib/constants/pricing'
import { PricingClient } from './PricingClient'

/** The cheapest monthly plan, derived — never a literal, so the meta follows a price change. */
const LOWEST_MONTHLY = Math.min(...TIER_ORDER.map((id) => TIERS[id].monthly))

export const metadata: Metadata = {
  title: 'Pricing — Simple monthly plans, no commissions | TradeLynq',
  description: `Customers browse free. Professionals subscribe from ${formatTTD(
    LOWEST_MONTHLY
  )}/month — no commissions, ever. See all five plans, the Pioneer Programme, and the Registered rate on TradeLynq.`,
}

/**
 * FAQ-lite — the price-free questions from §9.9, verbatim. Questions whose
 * answers carry money (the registration fee, the Registered rate) are covered in
 * their own sections from the constants, so no price is ever duplicated as prose.
 */
const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'Do customers pay anything?',
    a: 'No. Customers browse, compare, and contact professionals completely free. Professionals pay to be found and to run their business on TradeLynq.',
  },
  {
    q: 'Are there any commissions on jobs?',
    a: 'None. You keep 100% of what you earn. Your monthly plan is the only fee — we never take a cut of your work.',
  },
  {
    q: 'Can I change plans or cancel later?',
    a: 'Yes. Upgrade, downgrade, or cancel any time from your workspace. Changes take effect from your next billing date.',
  },
  {
    q: 'How do I pay?',
    a: "We accept card payment and local options including WiPay. You'll set this up when your plan starts — and during the Pioneer trial, nothing is charged until month 3.",
  },
]

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      {/* ── Header ── */}
      <header className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <h1 className="text-display-2xl text-foreground text-balance">
          Simple pricing. No commissions, ever.
        </h1>
        <p className="text-body text-lg text-pretty">
          Customers browse free. Professionals subscribe.
        </p>
      </header>

      {/* ── Account-type + billing controls, and the tier grid ── */}
      <div className="mt-10 sm:mt-12">
        <PricingClient />
      </div>

      {/* ── Registration fee note ── */}
      <p className="text-muted mx-auto mt-6 max-w-2xl text-center text-sm text-pretty">
        All plans include a one-time registration fee —{' '}
        <span className="text-body font-mono tabular-nums">
          {formatTTD(REGISTRATION_FEE.standard)}
        </span>
        , or{' '}
        <span className="text-body font-mono tabular-nums">
          {formatTTD(REGISTRATION_FEE.student)}
        </span>{' '}
        for students. The Pioneer Programme’s free months are a discount on your subscription; the
        registration fee still applies.
      </p>

      {/* ── How the Pioneer Programme works ── */}
      <section
        aria-labelledby="pioneer-heading"
        className="border-border bg-card-subtle mt-14 rounded-[--radius-panel] border p-6 sm:mt-16 sm:p-8"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <h2 id="pioneer-heading" className="text-display-sm text-foreground">
            How the Pioneer Programme works
          </h2>
          <p className="text-body text-pretty">
            The first{' '}
            <span className="text-foreground font-mono tabular-nums">{PIONEER.totalCap}</span>{' '}
            professionals to join get their first{' '}
            <span className="text-foreground font-mono tabular-nums">{PIONEER.freeMonths}</span>{' '}
            months free — full tools, with no charge during the trial. Places are limited to{' '}
            <span className="text-foreground font-mono tabular-nums">{PIONEER.perCategoryCap}</span>{' '}
            per category, so every trade launches with real choice, and the programme closes on{' '}
            {formatDate(PIONEER.backstopDate)} or once all{' '}
            <span className="text-foreground font-mono tabular-nums">{PIONEER.totalCap}</span>{' '}
            places fill.
          </p>
          <p className="text-muted text-sm text-pretty">
            The free months are a discount on your subscription, not a free account — the one-time
            registration fee still applies. Pioneer months don’t count toward your paid months, so
            the Registered rate only begins once you’re actually paying.
          </p>
        </div>
      </section>

      {/* ── FAQ-lite ── */}
      <section aria-labelledby="faq-heading" className="mt-14 sm:mt-16">
        <h2 id="faq-heading" className="text-display-sm text-foreground text-center">
          Common questions
        </h2>
        <dl className="mx-auto mt-6 grid max-w-4xl gap-4 sm:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.q} className="border-border bg-card rounded-[--radius-card] border p-5">
              <dt className="text-foreground font-medium">{item.q}</dt>
              <dd className="text-body mt-1.5 text-sm text-pretty">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
