/**
 * Pricing page (playbook S088, spec v2/03 §3.8; launch regime per D62).
 *
 * The page renders one of two stories from `PRICING_MODE`:
 *
 * `launch` — the regime the platform runs today. One flat rate after a free
 * window, everything included, no tiers on show. The page tells that story in
 * three dated phases and never mentions the shelved tier names — a visitor
 * must not see two competing pricing models.
 *
 * `tiers` — the full five-tier + crossover page, kept intact below for the
 * day the flag flips back.
 *
 * The chapter's acceptance test is single-sourcing — "numbers rendered
 * exclusively from lib/constants/pricing.ts (a price change is a one-file
 * change)" — so this file hardcodes NO money. Every figure derives from
 * `LAUNCH_PRICING`, `PIONEER`, `REGISTRATION_FEE`, and the tier table.
 */
import type { Metadata } from 'next'
import { formatTTD, formatDate } from '@/lib/utils/format'
import {
  LAUNCH_PRICING,
  PIONEER,
  PRICING_MODE,
  REGISTRATION_FEE,
  TIERS,
  TIER_ORDER,
} from '@/lib/constants/pricing'
import { PricingClient } from './PricingClient'

/** The cheapest monthly plan, derived — never a literal, so the meta follows a price change. */
const LOWEST_MONTHLY = Math.min(...TIER_ORDER.map((id) => TIERS[id].monthly))

export const metadata: Metadata =
  PRICING_MODE === 'launch'
    ? {
        title: 'Pricing — Free through launch, then one flat rate | TradeLynq',
        description: `Customers browse free. Professionals join free through ${formatDate(
          LAUNCH_PRICING.freeUntil
        )}, then pay one flat ${formatTTD(
          LAUNCH_PRICING.baselineMonthly
        )}/month — every tool included, no commissions, ever.`,
      }
    : {
        title: 'Pricing — Simple monthly plans, no commissions | TradeLynq',
        description: `Customers browse free. Professionals subscribe from ${formatTTD(
          LOWEST_MONTHLY
        )}/month — no commissions, ever. See all five plans, the Pioneer Programme, and the Registered rate on TradeLynq.`,
      }

// ── Launch regime (D62) ───────────────────────────────────────────────────────

/**
 * The three dated phases of launch pricing. Copy states plainly what is free,
 * until when, and what it costs after — no anchoring games, no struck prices.
 */
const LAUNCH_PHASES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'Join now — free',
    body: `Every tool from day one: your storefront, enquiries, quotes, invoices, jobs, and your client book. The one-time registration fee is the only cost.`,
  },
  {
    title: `Free through ${formatDate(LAUNCH_PRICING.freeUntil)}`,
    body: 'The beta and Pioneer period. No subscription, no card on file, no surprises — you build your presence while the platform earns its keep.',
  },
  {
    title: 'Then one flat rate',
    body: `${formatTTD(LAUNCH_PRICING.baselineMonthly)}/month for every professional, everything still included. Students pay ${formatTTD(
      LAUNCH_PRICING.studentMonthly
    )}/month, and scholarships can bring that to zero. You'll get clear notice well before billing begins.`,
  },
]

const LAUNCH_FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'Do customers pay anything?',
    a: 'No. Customers browse, compare, and contact professionals completely free. Professionals pay to be found and to run their business on TradeLynq.',
  },
  {
    q: 'Are there any commissions on jobs?',
    a: 'None. You keep 100% of what you earn. Your monthly plan is the only fee — we never take a cut of your work.',
  },
  {
    q: 'What happens when the free window ends?',
    a: `Nothing sudden. We give you clear notice before billing begins, and the rate is the same flat amount for everyone — cancel any time from your workspace.`,
  },
  {
    q: 'How do I pay?',
    a: 'The registration fee is payable when you sign up, by card or local options including WiPay. Subscription billing only starts after the free window.',
  },
  {
    q: 'Will there be bigger plans later?',
    a: 'Yes — optional plans with advanced tools, including AI assistance, arrive after launch. Everything you get today stays in the flat rate.',
  },
  {
    q: 'Is the registration fee refundable?',
    a: 'It covers verifying and setting up your storefront, so it applies once your account is approved. If we decline your application, you are not charged.',
  },
]

function LaunchPricing() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      {/* ── Header ── */}
      <header className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <h1 className="text-display-2xl text-foreground text-balance">
          Simple pricing. No commissions, ever.
        </h1>
        <p className="text-body text-lg text-pretty">
          Customers browse free. Professionals join free through{' '}
          <span className="font-mono tabular-nums">{formatDate(LAUNCH_PRICING.freeUntil)}</span> —
          one flat rate after.
        </p>
      </header>

      {/* ── The three phases ── */}
      <ol className="mx-auto mt-10 grid max-w-4xl gap-4 sm:mt-12 sm:grid-cols-3">
        {LAUNCH_PHASES.map((phase, index) => (
          <li
            key={phase.title}
            className="border-border bg-card flex flex-col gap-2 rounded-[--radius-card] border p-6"
          >
            <span className="text-muted font-mono text-sm tabular-nums">{index + 1}</span>
            <h2 className="text-foreground font-medium">{phase.title}</h2>
            <p className="text-body text-sm text-pretty">{phase.body}</p>
          </li>
        ))}
      </ol>

      {/* ── The flat rate, stated once, large ── */}
      <section
        aria-labelledby="rate-heading"
        className="border-border bg-card-subtle mt-10 rounded-[--radius-panel] border p-6 text-center sm:p-8"
      >
        <h2 id="rate-heading" className="text-display-sm text-foreground">
          One rate. Everything included.
        </h2>
        <p className="text-foreground mt-3 font-mono text-4xl tabular-nums">
          {formatTTD(LAUNCH_PRICING.baselineMonthly)}
          <span className="text-muted text-lg">/month</span>
        </p>
        <p className="text-muted mt-2 text-sm text-pretty">
          After the free window. Students{' '}
          <span className="font-mono tabular-nums">{formatTTD(LAUNCH_PRICING.studentMonthly)}</span>
          /month — scholarships available. Optional plans with advanced tools, including AI
          assistance, arrive after launch.
        </p>
      </section>

      {/* ── Registration fee note ── */}
      <p className="text-muted mx-auto mt-6 max-w-2xl text-center text-sm text-pretty">
        Joining includes a one-time registration fee —{' '}
        <span className="text-body font-mono tabular-nums">
          {formatTTD(REGISTRATION_FEE.standard)}
        </span>
        , or{' '}
        <span className="text-body font-mono tabular-nums">
          {formatTTD(REGISTRATION_FEE.student)}
        </span>{' '}
        for students. It covers verification and your storefront setup, and it is the only cost
        during the free window.
      </p>

      {/* ── FAQ ── */}
      <section aria-labelledby="faq-heading" className="mt-14 sm:mt-16">
        <h2 id="faq-heading" className="text-display-sm text-foreground text-center">
          Common questions
        </h2>
        <dl className="mx-auto mt-6 grid max-w-4xl gap-4 sm:grid-cols-2">
          {LAUNCH_FAQ.map((item) => (
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

// ── Tier regime (shelved by D62, intact for the flag flip) ────────────────────

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

function TierPricing() {
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

export default function PricingPage() {
  return PRICING_MODE === 'launch' ? <LaunchPricing /> : <TierPricing />
}
