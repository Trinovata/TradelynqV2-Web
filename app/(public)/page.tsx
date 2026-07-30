/**
 * Landing page (playbook S077).
 *
 * R2 "Ink & Paper" palette, real display typography (Bricolage Grotesque), and a
 * clean editorial hero — the type carries it, over a single calm signature: a
 * ring of connections orbiting the centre (ConnectionField), its middle cleared
 * so the headline lands on quiet space.
 *
 * Persuasion structure (each section is one self-contained unit — short benefit
 * headline, one-line support, a proof element):
 *
 *   hero (search + trust strip) → product showcase → problem/solution ledger →
 *   how it works → categories (real counts) → featured professionals (real
 *   supply) → the three promises → professional CTA.
 *
 * Two hard rules shape everything here. Only real data renders — the showcase,
 * category counts, and proof rails come from live queries and disappear rather
 * than fake it when supply is empty. And trust claims are structural promises
 * (identity checked, reviews moderated, no booking fees), never invented
 * numbers.
 */
import Link from 'next/link'
import {
  ShieldCheck,
  Star,
  MessageCircle,
  PencilLine,
  Users,
  Handshake,
  ArrowRight,
} from 'lucide-react'
import { getCategoryTree, getFeaturedProfessionals } from '@/lib/marketplace/queries'
import { ProfessionalCard } from '@/components/shared/ProfessionalCard'
import { ProblemSolution } from '@/components/shared/ProblemSolution'
import { FlowLine } from '@/components/shared/FlowLine'
import { NumberTicker } from '@/components/shared/NumberTicker'
import { PhoneFlow } from '@/components/shared/PhoneFlow'
import { ConnectionField } from '@/components/shared/ConnectionField'
import { HarbourHero } from '@/components/shared/HarbourHero'
import { CategoryShowcase } from '@/components/shared/CategoryShowcase'
import { Button } from '@/components/ui/Button'
import { Reveal } from '@/components/shared/Reveal'
import { Marquee } from '@/components/ui/marquee'
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text'
import { HeroSearch } from './HeroSearch'

/**
 * The faint monochrome dot grid behind the hero and the closing CTA — the same
 * texture bookending the page so it opens and closes on one visual note. No
 * colour: it only keeps the field from reading as flat white.
 */
function DotGrid() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,black,transparent)] opacity-[0.4]"
      style={{
        backgroundImage:
          'radial-gradient(color-mix(in oklch, var(--muted) 22%, transparent) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    />
  )
}

/**
 * One header shape for every section: a quiet uppercase eyebrow, a display
 * headline, one supporting line. The repetition is the point — consistent
 * rhythm is what makes a long page read as designed rather than assembled.
 */
function SectionHeader({
  eyebrow,
  title,
  support,
  align = 'left',
  className = '',
}: {
  eyebrow: string
  title: string
  support?: React.ReactNode
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <Reveal
      className={`flex max-w-2xl flex-col gap-3 ${align === 'center' ? 'items-center text-center' : ''} ${className}`}
    >
      <p className="text-muted text-xs font-medium tracking-[0.14em] uppercase">{eyebrow}</p>
      <h2 className="font-display text-foreground text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {support && <p className="text-body text-pretty">{support}</p>}
    </Reveal>
  )
}

export default async function LandingPage() {
  const [categories, featured] = await Promise.all([getCategoryTree(), getFeaturedProfessionals(6)])

  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className="relative isolate overflow-hidden">
        {/* Signature: a calm ring of connections orbiting the centre — the
            customer, and the professionals reachable around them. One layer, no
            labels, centre cleared so the headline reads on quiet space. It is
            also the POSTER for the 3D layer: the harbour diorama (D67 wow
            pass) crossfades over it after load, and every guardrailed case
            (reduced motion, save-data, kill flag) simply keeps this field. */}
        <ConnectionField />
        <HarbourHero />
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-7 px-4 pt-24 pb-16 text-center sm:px-6 sm:pt-32 sm:pb-24">
          <span className="border-border bg-card inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium">
            <span className="bg-success size-1.5 rounded-full" aria-hidden="true" />
            <AnimatedShinyText className="mx-0 max-w-none text-xs">
              Verified professionals across Trinidad &amp; Tobago
            </AnimatedShinyText>
          </span>

          {/* V1's 900-weight hero (D67) — heavy, confident, unmistakably ours. */}
          <h1 className="font-display text-foreground max-w-3xl text-[clamp(2.6rem,7.5vw,5rem)] leading-[0.96] font-black tracking-[-0.025em] text-balance">
            Whatever you need done, someone here does it well.
          </h1>

          <p className="text-body max-w-xl text-lg text-pretty">
            Describe your project, compare verified professionals, and reach them straight on
            WhatsApp.
          </p>

          <div className="w-full max-w-2xl">
            <HeroSearch />
          </div>

          {/* Trust, before the first scroll: the three promises in miniature.
              Each is expanded lower down — this is the page's thesis stated up
              front, not decoration. */}
          <ul className="text-muted flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            {[
              // V1's trust-bar colour logic, carried forward: verification is
              // green, reviews are amber, WhatsApp is its own brand green.
              { icon: ShieldCheck, label: 'Identity checked', colour: 'text-success' },
              { icon: Star, label: 'Every review moderated', colour: 'text-brand-amber' },
              {
                icon: MessageCircle,
                label: 'Free for customers — always',
                colour: 'text-whatsapp',
              },
            ].map((item) => (
              <li key={item.label} className="inline-flex items-center gap-1.5">
                <item.icon className={`size-4 shrink-0 ${item.colour}`} aria-hidden="true" />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Category ticker — the V1 marquee moment: every category gliding by,
          real taxonomy, decorative only (the Categories section below is the
          navigable version). Pauses on hover; reduced-motion stills it. ── */}
      {categories.length > 0 && (
        <div className="border-border bg-card-subtle/40 border-y py-3" aria-hidden="true">
          <Marquee pauseOnHover className="[--duration:45s] [--gap:2.5rem]">
            {categories.map((node) => (
              <span
                key={node.parent.slug}
                className="text-muted inline-flex items-center gap-2.5 text-sm font-medium whitespace-nowrap"
              >
                {node.parent.name}
                <span className="bg-brand-cyan/60 size-1 rounded-full" />
              </span>
            ))}
          </Marquee>
        </div>
      )}

      {/* ── Product showcase — a two-column split: the story on the left, the
          real journey playing on a phone on the right. No scroll gimmick. ── */}
      {featured.length > 0 && (
        <section className="border-border bg-card-subtle/50 border-y">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-2 lg:gap-8">
            <Reveal className="flex flex-col gap-5">
              <p className="text-muted text-xs font-medium tracking-[0.14em] uppercase">
                The whole journey
              </p>
              <h2 className="font-display text-foreground text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                From a problem to a plumber — in four taps.
              </h2>
              <p className="text-body text-pretty">
                Type what you need, compare verified professionals, open a storefront, and pick up
                the conversation on WhatsApp. No account to browse, no middleman, no booking fee.
              </p>
              <ol className="mt-2 flex flex-col gap-3">
                {[
                  { n: '01', label: 'Search in plain words' },
                  { n: '02', label: 'Compare real reviews and prices' },
                  { n: '03', label: 'Open a verified storefront' },
                  { n: '04', label: 'Chat directly on WhatsApp' },
                ].map((step) => (
                  <li key={step.n} className="flex items-center gap-3">
                    <span className="text-brand-cyan-ink font-mono text-sm font-medium tabular-nums">
                      {step.n}
                    </span>
                    <span className="text-foreground text-sm">{step.label}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-2">
                <Button asChild>
                  <Link href="/search">Try it now</Link>
                </Button>
              </div>
            </Reveal>

            {/* The real journey, playing on a phone — real seed data, tokens
                throughout, so it re-themes with the site. */}
            <div className="relative min-h-[34rem]">
              <PhoneFlow professional={featured[0]!} />
            </div>
          </div>
        </section>
      )}

      {/* ── Problem → solution ── */}
      <section className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeader
          eyebrow="Why TradeLynq"
          title="Finding someone good shouldn't come down to luck."
          support="Word of mouth is how it has always worked — until you need someone your circle doesn't know. Here is exactly what changes."
          className="mb-10"
        />
        <ProblemSolution
          problemLabel="The usual way"
          solutionLabel="On TradeLynq"
          pairs={[
            {
              problem: 'A number forwarded through three group chats, with no way to check it.',
              solution: 'Real profiles, identity checked against a National ID or Passport.',
            },
            {
              problem: "One friend's opinion is the entire reference check.",
              solution: 'Moderated reviews, each one tied to a job that actually happened.',
            },
            {
              problem: 'Call, wait, hear nothing, start the search over.',
              solution: 'Compare professionals side by side and message them on WhatsApp.',
            },
            {
              problem: 'Platforms that sit in the middle and take a cut.',
              solution: 'Direct contact, no middleman — and customers never pay a booking fee.',
            },
          ]}
        />
      </section>

      {/* ── How it works ── */}
      <section className="border-border bg-card-subtle/60 border-y">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <SectionHeader
            eyebrow="How it works"
            title="From “I need someone” to “sorted” — in three steps."
            support="Browse without an account. Reach out only when you're ready."
            className="mb-12"
          />
          {/* The journey line: draws across the three steps as the section
              arrives — V1 cyan doing what it does best, signalling progress. */}
          <FlowLine className="-mb-px hidden sm:block" />
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-3">
            {[
              {
                icon: PencilLine,
                step: '01',
                title: 'Say what you need',
                body: 'Describe the job in your own words, or browse by category and area — beauty, trades, tech, events, education and more. No sign-up to browse.',
              },
              {
                icon: Users,
                step: '02',
                title: 'Read real reviews',
                body: 'Every review is moderated and linked to a real job. See verified testimonials from real clients — no fake ratings, ever.',
              },
              {
                icon: Handshake,
                step: '03',
                title: 'Get in touch directly',
                body: 'Reach the professional straight on WhatsApp, phone, or email — no platform middleman, no booking fees.',
              },
            ].map((item, index) => (
              <Reveal
                key={item.step}
                delay={index * 90}
                className="border-border flex flex-col gap-3 border-t pt-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-brand-cyan-ink font-mono text-sm font-medium tabular-nums">
                    {item.step}
                  </span>
                  <item.icon className="text-accent-ink size-5" aria-hidden="true" />
                </div>
                <h3 className="text-foreground text-lg font-medium">{item.title}</h3>
                <p className="text-body text-sm leading-relaxed">{item.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ── */}
      {categories.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="flex max-w-2xl flex-col gap-3">
              <p className="text-muted text-xs font-medium tracking-[0.14em] uppercase">
                Categories
              </p>
              <h2 className="font-display text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                What people are booking
              </h2>
              <p className="text-body">
                <NumberTicker value={categories.length} className="text-foreground" /> categories ·{' '}
                <NumberTicker
                  value={categories.reduce((total, node) => total + node.children.length, 0)}
                  className="text-foreground"
                />{' '}
                specialities, from beauty to building work.
              </p>
            </div>
            <Link
              href="/search"
              className="text-accent-ink group inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              All categories
              <ArrowRight
                className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </Reveal>
          <CategoryShowcase categories={categories} />
        </section>
      )}

      {/* ── Featured supply (real only) ── */}
      {featured.length > 0 && (
        <section className="border-border border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div className="flex max-w-2xl flex-col gap-3">
                <p className="text-muted text-xs font-medium tracking-[0.14em] uppercase">
                  Professionals
                </p>
                <h2 className="font-display text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                  Highly rated right now
                </h2>
                <p className="text-body">Ranked by rating and reviews — never by who pays.</p>
              </div>
              <Link
                href="/search"
                className="text-accent-ink group inline-flex items-center gap-1 text-sm font-medium hover:underline"
              >
                Browse all
                <ArrowRight
                  className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((pro, index) => (
                <Reveal key={pro.id} delay={Math.min(index, 5) * 60}>
                  <ProfessionalCard data={pro} source="search" position={index} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── The three promises ── */}
      <section className="border-border bg-card-subtle/60 border-y">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <SectionHeader
            eyebrow="The promises"
            title="Trust is the product — so it's built in, not bolted on."
            support="No paid rankings and no invented ratings. A badge here means we checked something real."
            className="mb-12"
          />
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-3">
            {[
              // The same V1 colour logic as the hero strip, expanded: each
              // promise carries its own accent, so the section reads as three
              // distinct guarantees rather than three grey paragraphs.
              {
                icon: ShieldCheck,
                step: '01',
                colour: 'text-success',
                title: 'Identity verified',
                body: 'Professionals upload a National ID or Passport, reviewed by our team. A green badge means we checked something real — never a paid ranking.',
              },
              {
                icon: Star,
                step: '02',
                colour: 'text-brand-amber',
                title: 'Moderated reviews',
                body: 'Every review is checked before it goes live and linked to a real job. No fake testimonials, ever.',
              },
              {
                icon: MessageCircle,
                step: '03',
                colour: 'text-whatsapp',
                title: 'No middleman, no fees',
                body: 'You reach professionals directly on WhatsApp. We never sit between you and the work, and we never charge a booking fee.',
              },
            ].map((item, index) => (
              <Reveal
                key={item.title}
                delay={index * 90}
                className="border-border flex flex-col gap-3 border-t pt-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-muted font-mono text-sm tabular-nums">{item.step}</span>
                  <item.icon className={`size-5 ${item.colour}`} aria-hidden="true" />
                </div>
                <h3 className="text-foreground text-lg font-medium">{item.title}</h3>
                <p className="text-body text-sm leading-relaxed">{item.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Professional CTA ── */}
      <section className="relative isolate overflow-hidden">
        <DotGrid />
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-28">
          <p className="text-muted text-xs font-medium tracking-[0.14em] uppercase">
            For professionals
          </p>
          <h2 className="font-display text-foreground text-[clamp(2rem,5vw,3.25rem)] leading-tight font-black tracking-[-0.02em] text-balance">
            Run your trade like a business.
          </h2>
          <p className="text-body max-w-xl text-pretty">
            A storefront customers can find, real reviews, quotes and invoices, and the tools to
            grow — built for professionals across Trinidad &amp; Tobago.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">List your business</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
