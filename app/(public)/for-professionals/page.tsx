import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { whatsappDigits } from '@/lib/whatsapp'
import { SUPPORT_PHONE } from '@/lib/constants/contact'
import { TIERS, TIER_ORDER } from '@/lib/constants/pricing'
import { formatTTD } from '@/lib/utils/format'

/**
 * For Professionals (playbook S089, spec v2/03 §3.9, copy deck §10 — every
 * string verbatim).
 *
 * FLAGS:
 * - §10.4 product proof calls for 3 annotated screenshots of REAL current UI.
 *   No captured assets exist and fabricating them violates the anti-slop
 *   covenant — the section is omitted until the screenshots are taken
 *   (deck captions preserved in a comment below for that day).
 * - §10.2's CTA target /signup?role=worker is a V1-ism; role selection is
 *   /auth/select-role after signup (S054), so CTAs go to /signup plainly.
 */
export const metadata: Metadata = {
  title: 'For Professionals — Turn your reputation into a business | TradeLynq',
  description:
    'Create a verified storefront, collect real reviews, and receive enquiries from customers across Trinidad & Tobago. Three ways to list — from TTD $200/month.',
}

/* §10.4 captions, held for the screenshot session:
 * 1. "Your storefront — reviews, portfolio, and prices in one place."
 * 2. "Enquiries — customers reach you directly, and you reply in a tap."
 * 3. "Invoicing — send branded quotes and invoices without leaving TradeLynq."
 */

const ACCOUNT_PATHS = [
  {
    title: 'Student Entrepreneur',
    who: 'Students and young adults (16–26) starting their first income stream.',
    requirements: "Proof you're 16–26 (student ID or age).",
    priceLine: 'TTD $100 registration · 6 months of Presence free.',
    badge: { variant: 'student' as const, label: 'Student Entrepreneur' },
    cta: 'Start free',
  },
  {
    title: 'Small Business',
    who: 'Sole traders and informal businesses ready to be found — new or established.',
    requirements: 'A government-issued ID.',
    priceLine: 'TTD $200 registration · plans from TTD $200/month · 50% off your first 3 months.',
    badge: { variant: 'verified' as const, label: 'Verified Professional' },
    cta: 'Get listed',
  },
  {
    title: 'Registered Business',
    who: 'Legally registered companies that want the strongest trust signal and more tools.',
    requirements: 'Company registration documents (or register with us).',
    priceLine:
      'TTD $200 registration · plan + TTD $100/month Registered rate — locked lower, permanently.',
    badge: { variant: 'registered' as const, label: 'Registered Business' },
    cta: 'Verify your company',
  },
]

const EARNINGS_STEPS = [
  'Do great work and collect verified reviews.',
  'Better reviews lift your ranking in search.',
  'Higher ranking means more enquiries — and more work.',
]

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Do I need a registered company to join?',
    a: 'No. Most professionals start as a Small Business (sole trader) with just a government ID. You can register later — and we can help you do it.',
  },
  {
    q: 'How much does it cost to start?',
    a: 'A one-time TTD $200 registration fee (TTD $100 for students), then a monthly plan from TTD $200. Your first 3 months are 50% off, and Pioneer members get 3 months free.',
  },
  {
    q: 'How do customers find me?',
    a: 'Through search and category pages. The more verified reviews you collect and the better your storefront, the higher you rank.',
  },
  {
    q: 'Do you take a commission on my jobs?',
    a: 'Never. You keep everything you earn. The monthly plan is the only fee.',
  },
  {
    q: 'How do reviews work?',
    a: "Customers you've worked with leave reviews, and our team approves them before they show. Genuine, verified feedback is what builds your ranking.",
  },
  {
    q: "What's the difference between Small Business and Registered Business?",
    a: 'A Registered Business is a legally registered company. It gets the Registered badge, ads eligibility, multi-listing, and the lower Registered rate — TTD $100/month on top of your plan, locked in permanently.',
  },
  {
    q: 'Can I get help setting up?',
    a: "Yes. Message us on WhatsApp any time and we'll walk you through it — setup, verification, or choosing a plan.",
  },
]

export default function ForProfessionalsPage() {
  const supportDigits = whatsappDigits(SUPPORT_PHONE)
  const supportHref = supportDigits
    ? `https://wa.me/${supportDigits}?text=${encodeURIComponent('Not sure which plan fits — can you help?')}`
    : '/signup'

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      {/* §10.2 Hero */}
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="text-foreground font-display text-4xl tracking-tight text-balance sm:text-5xl">
          Turn your reputation into a business.
        </h1>
        <p className="text-body mt-4 text-lg text-pretty">
          Get a verified storefront, collect real reviews, and receive enquiries — all in one place,
          built for T&amp;T.
        </p>
        <div className="mt-8">
          <Button asChild size="lg">
            <Link href="/signup">Create your storefront</Link>
          </Button>
        </div>
      </header>

      {/* §10.3 Three ways to list */}
      <section id="account-types" className="mt-20">
        <h2 className="text-foreground font-display text-center text-2xl">Three ways to list</h2>
        <p className="text-muted mt-2 text-center text-sm">
          Student Entrepreneur <ArrowRight className="inline size-3.5" aria-hidden="true" /> Small
          Business <ArrowRight className="inline size-3.5" aria-hidden="true" /> Registered Business
        </p>
        <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {ACCOUNT_PATHS.map((path) => (
            <li
              key={path.title}
              className="border-border bg-card flex flex-col gap-3 rounded-[--radius-card] border p-6"
            >
              <Badge variant={path.badge.variant}>{path.badge.label}</Badge>
              <h3 className="text-foreground text-lg font-medium">{path.title}</h3>
              <p className="text-body text-sm">{path.who}</p>
              <p className="text-muted text-sm">
                <span className="text-foreground font-medium">Requirements: </span>
                {path.requirements}
              </p>
              <p className="text-body font-mono text-sm tabular-nums">{path.priceLine}</p>
              <div className="mt-auto pt-2">
                <Button asChild variant="secondary" fullWidth>
                  <Link href="/signup">{path.cta}</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* §10.5 Earnings logic */}
      <section className="mt-20 text-center">
        <h2 className="text-foreground font-display text-2xl">How you get found</h2>
        <ol className="mx-auto mt-6 flex max-w-3xl flex-col gap-4 sm:flex-row sm:gap-6">
          {EARNINGS_STEPS.map((step, index) => (
            <li key={step} className="flex-1">
              <span className="text-muted font-mono text-sm tabular-nums">{index + 1}</span>
              <p className="text-body mt-1 text-sm">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* §10.6 Pricing summary + registration cross-sell */}
      <section className="mt-20">
        <div className="border-border bg-card-subtle rounded-[--radius-card] border p-6 text-center">
          <h2 className="text-foreground font-display text-xl">Plans from TTD $200/month</h2>
          <p className="text-muted mt-2 font-mono text-sm tabular-nums">
            {TIER_ORDER.map((id) => `${TIERS[id].name} ${formatTTD(TIERS[id].monthly)}`).join(
              ' · '
            )}
          </p>
          <Link
            href="/pricing"
            className="text-foreground mt-3 inline-block text-sm font-medium underline underline-offset-4"
          >
            See full pricing
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="border-border bg-card flex flex-col gap-2 rounded-[--radius-card] border p-6">
            <h3 className="text-foreground font-medium">Register your business yourself</h3>
            <p className="text-body text-sm">
              A free, step-by-step guide to registering in Trinidad &amp; Tobago — we hide nothing.
            </p>
            <div className="mt-auto pt-2">
              <Button asChild variant="secondary">
                <Link href="/for-professionals/register-your-business">Read the free guide</Link>
              </Button>
            </div>
          </div>
          <div className="border-border bg-card flex flex-col gap-2 rounded-[--radius-card] border p-6">
            <h3 className="text-foreground font-medium">We do it for you</h3>
            <p className="text-body text-sm">
              Submit your details once and our partner handles the filings. Your Registered account
              activates with the first month free.
            </p>
            <div className="mt-auto pt-2">
              <Button asChild variant="secondary">
                <Link href="/for-professionals/register-your-business">See the Launch Bundle</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* §10.7 FAQ */}
      <section className="mx-auto mt-20 max-w-3xl">
        <h2 className="text-foreground font-display text-center text-2xl">Common questions</h2>
        <dl className="mt-8 flex flex-col gap-6">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="text-foreground font-medium">{item.q}</dt>
              <dd className="text-body mt-1 text-sm leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* §10.8 CTA band */}
      <section className="border-border bg-card mt-20 rounded-[--radius-card] border p-8 text-center">
        <h2 className="text-foreground font-display text-2xl">Start where you are.</h2>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Create your storefront</Link>
          </Button>
        </div>
        <a
          href={supportHref}
          className="text-body hover:text-foreground mt-4 inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          Not sure which fits? Chat with us.
        </a>
      </section>
    </div>
  )
}
