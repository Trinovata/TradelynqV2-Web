/**
 * Landing page (playbook S077).
 *
 * R2 "Ink & Paper" palette, real display typography (Bricolage Grotesque), and a
 * clean editorial hero — the type carries it, over a faint monochrome dot grid.
 * The signature moment is the scroll-driven 3D showcase: the real product,
 * browser-framed, rotating into view. Server-rendered so the first paint is
 * content; choreographed with scroll reveals. Real supply only — the showcase
 * and proof strips render nothing when there are no active professionals.
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
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Reveal } from '@/components/shared/Reveal'
import { ContainerScroll } from '@/components/ui/container-scroll-animation'
import { HeroSearch } from './HeroSearch'

export default async function LandingPage() {
  const [categories, featured] = await Promise.all([getCategoryTree(), getFeaturedProfessionals(6)])

  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className="relative isolate overflow-hidden">
        {/* Subtle, monochrome depth — a faint dot grid that fades out toward the
            content. No colour: the type carries the page, the texture only keeps
            the field from reading as flat white. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,black,transparent)] opacity-[0.4]"
          style={{
            backgroundImage:
              'radial-gradient(color-mix(in oklch, var(--muted) 22%, transparent) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-7 px-4 pt-24 pb-20 text-center sm:px-6 sm:pt-32 sm:pb-28">
          <span className="border-border bg-card text-body inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium">
            <span className="bg-success size-1.5 rounded-full" aria-hidden="true" />
            Verified professionals across Trinidad &amp; Tobago
          </span>

          <h1 className="font-display text-foreground max-w-3xl text-[clamp(2.6rem,7.5vw,5rem)] leading-[0.96] font-semibold tracking-[-0.025em] text-balance">
            Whatever you need done, someone here does it well.
          </h1>

          <p className="text-body max-w-xl text-lg text-pretty">
            Describe your project, compare verified professionals, and reach them straight on
            WhatsApp. Free for customers — always.
          </p>

          <div className="w-full max-w-2xl">
            <HeroSearch />
          </div>
        </div>
      </section>

      {/* ── Product showcase (scroll-driven 3D reveal) ── */}
      {featured.length > 0 && (
        <section className="relative -mt-8 overflow-hidden sm:-mt-4">
          <ContainerScroll
            titleComponent={
              <div className="flex flex-col items-center gap-3 pb-2">
                <h2 className="font-display text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
                  The whole marketplace, in your pocket.
                </h2>
                <p className="text-muted max-w-md text-sm">
                  Search, compare, and reach real professionals — no account needed to look.
                </p>
              </div>
            }
          >
            {/* A browser frame around the real product — not a stock screenshot. */}
            <div className="flex h-full flex-col">
              <div className="border-border/60 bg-card flex items-center gap-2 border-b px-4 py-2.5">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="bg-muted/40 size-2.5 rounded-full" />
                  <span className="bg-muted/40 size-2.5 rounded-full" />
                  <span className="bg-muted/40 size-2.5 rounded-full" />
                </span>
                <span className="border-border bg-card-subtle text-muted ml-2 flex-1 truncate rounded-full border px-3 py-1 text-xs">
                  tradelynq.tt/search
                </span>
              </div>
              <div className="flex-1 overflow-hidden p-4 sm:p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {featured.slice(0, 3).map((pro, index) => (
                    <ProfessionalCard key={pro.id} data={pro} source="search" position={index} />
                  ))}
                </div>
              </div>
            </div>
          </ContainerScroll>
        </section>
      )}

      {/* ── How it works ── */}
      <section className="border-border bg-card-subtle/60 border-y">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <Reveal className="mb-10 max-w-2xl">
            <h2 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
              From “I need someone” to “sorted” — in three steps.
            </h2>
          </Reveal>
          <div className="grid gap-8 sm:grid-cols-3">
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
              <Reveal key={item.step} delay={index * 90} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-accent-ink/25 font-display text-4xl font-semibold tabular-nums">
                    {item.step}
                  </span>
                  <span className="bg-accent-soft text-accent-ink flex size-9 items-center justify-center rounded-full">
                    <item.icon className="size-4.5" aria-hidden="true" />
                  </span>
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
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <Reveal className="mb-8 flex items-end justify-between">
            <h2 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
              What people are booking
            </h2>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.slice(0, 8).map((node, index) => (
              <Reveal key={node.parent.slug} delay={Math.min(index, 7) * 40}>
                <Link
                  href={`/categories/${node.parent.slug}`}
                  className="group focus-visible:outline-ring block h-full rounded-[--radius-card] focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <Card
                    interactive
                    padding="compact"
                    className="h-full transition-transform duration-200 group-hover:-translate-y-0.5"
                  >
                    <span className="text-foreground font-medium">{node.parent.name}</span>
                    {node.children.length > 0 && (
                      <span className="text-muted mt-1 block text-xs">
                        {node.children
                          .slice(0, 3)
                          .map((c) => c.name)
                          .join(' · ')}
                        {node.children.length > 3 ? ' …' : ''}
                      </span>
                    )}
                  </Card>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ── Featured supply (real only) ── */}
      {featured.length > 0 && (
        <section className="border-border border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <Reveal className="mb-8 flex items-end justify-between">
              <h2 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
                Highly rated right now
              </h2>
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

      {/* ── Trust ── */}
      <section className="border-border bg-card-subtle/60 border-y">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:grid-cols-3 sm:px-6">
          {[
            {
              icon: ShieldCheck,
              title: 'Identity verified',
              body: 'Professionals upload a National ID or Passport, reviewed by our team. A green badge means we checked something real — never a paid ranking.',
            },
            {
              icon: Star,
              title: 'Moderated reviews',
              body: 'Every review is checked before it goes live and linked to a real job. No fake testimonials, ever.',
            },
            {
              icon: MessageCircle,
              title: 'No middleman, no fees',
              body: 'You reach professionals directly on WhatsApp. We never sit between you and the work, and we never charge a booking fee.',
            },
          ].map((item, index) => (
            <Reveal key={item.title} delay={index * 90} className="flex flex-col gap-3">
              <item.icon className="text-accent-ink size-7" aria-hidden="true" />
              <h3 className="text-foreground text-lg font-medium">{item.title}</h3>
              <p className="text-body text-sm leading-relaxed">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Pro CTA ── */}
      <section className="relative isolate overflow-hidden">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6">
          <h2 className="font-display text-foreground text-[clamp(2rem,5vw,3.25rem)] leading-tight font-semibold tracking-[-0.02em] text-balance">
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
