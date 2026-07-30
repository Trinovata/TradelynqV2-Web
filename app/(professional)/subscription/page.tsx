import type { Metadata } from 'next'
import { CalendarClock, Check, Sparkles } from 'lucide-react'
import { ToolStub } from '@/components/professional/ToolStub'
import { LAUNCH_PRICING, PRICING_MODE } from '@/lib/constants/pricing'
import { formatTTD, formatDate } from '@/lib/utils/format'

export const metadata: Metadata = { title: 'Subscription' }

/**
 * Subscription (playbook S115 carries the full account page; launch regime per D62).
 *
 * In launch mode there is no billing to manage — the honest page says exactly
 * that: what is free, until when, what it will cost after, and what is NOT
 * included yet. Everything renders from `lib/constants/pricing.ts`; no money
 * is hardcoded here. The tiers-mode page (plans, crossover, Pioneer countdown)
 * arrives with S115 when the flag flips.
 */

/** What the flat rate includes — the workspace, spelled out so "everything" is checkable. */
const INCLUDED: readonly string[] = [
  'Your public storefront and portfolio',
  'Enquiries, quotes, and invoices',
  'Jobs pipeline',
  'Client book (CRM)',
  'Reviews and verification badges',
  'Analytics and integrations',
]

function LaunchSubscription() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <h1 className="text-foreground font-display text-3xl tracking-tight">Subscription</h1>
        <p className="text-muted mt-1 text-sm">Your plan and what happens after the free window.</p>
      </header>

      {/* ── Current state: free ── */}
      <section
        aria-labelledby="window-heading"
        className="border-border bg-card rounded-[--radius-card] border p-6"
      >
        <div className="flex items-start gap-4">
          <span className="bg-accent-soft flex size-11 shrink-0 items-center justify-center rounded-[--radius-control]">
            <CalendarClock className="text-accent-ink size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="window-heading" className="text-foreground font-medium">
              Your subscription is free until{' '}
              <span className="font-mono tabular-nums">{formatDate(LAUNCH_PRICING.freeUntil)}</span>
            </h2>
            <p className="text-body mt-1 text-sm text-pretty">
              Every tool below is included at no charge through the launch window. There is nothing
              to set up and no card on file — this page becomes your billing home when the window
              closes, and you’ll get clear notice well before then.
            </p>
          </div>
        </div>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {INCLUDED.map((item) => (
            <li key={item} className="text-body flex items-center gap-2 text-sm">
              <Check className="text-accent-ink size-4 shrink-0" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* ── What it costs after ── */}
      <section
        aria-labelledby="after-heading"
        className="border-border bg-card-subtle mt-4 rounded-[--radius-card] border p-6"
      >
        <h2 id="after-heading" className="text-foreground font-medium">
          After the free window
        </h2>
        <p className="text-body mt-1 text-sm text-pretty">
          One flat rate —{' '}
          <span className="text-foreground font-mono tabular-nums">
            {formatTTD(LAUNCH_PRICING.baselineMonthly)}
          </span>
          /month, everything above included. Students pay{' '}
          <span className="text-foreground font-mono tabular-nums">
            {formatTTD(LAUNCH_PRICING.studentMonthly)}
          </span>
          /month, and scholarships can bring that to zero.
        </p>
      </section>

      {/* ── Honest note on what is not here yet ── */}
      <section
        aria-labelledby="later-heading"
        className="border-border bg-card mt-4 rounded-[--radius-card] border p-6"
      >
        <div className="flex items-start gap-4">
          <span className="bg-accent-soft flex size-11 shrink-0 items-center justify-center rounded-[--radius-control]">
            <Sparkles className="text-accent-ink size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="later-heading" className="text-foreground font-medium">
              Coming after launch
            </h2>
            <p className="text-body mt-1 text-sm text-pretty">
              Optional plans with advanced tools — including AI reply drafts and the assistant —
              arrive after launch as paid add-ons. Nothing you have today moves behind them.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default function SubscriptionPage() {
  if (PRICING_MODE === 'launch') return <LaunchSubscription />
  // S115 builds the full plans/billing page for the tiers regime.
  return <ToolStub title="Subscription" description="Your plan, billing and the Registered rate." />
}
