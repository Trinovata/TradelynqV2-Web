/**
 * Landing page (playbook S077, spec v2/03 §3.2).
 *
 * Server component — the category tree and featured supply are fetched on the
 * server so the first paint is content, not a spinner. The one interactive piece
 * is the hero project-search (`HeroSearch`), a small client island.
 *
 * The page is built on one idea: you describe what you need, and we find who does
 * it. Everything below the hero exists to make that promise credible — how it
 * works, the categories people actually search, why the pros are trustworthy,
 * and real supply (never invented — if there are no active professionals, the
 * proof strip simply does not render).
 */
import Link from 'next/link'
import { ShieldCheck, MessageCircle, Star, PencilLine, Users, Handshake } from 'lucide-react'
import { getCategoryTree, getFeaturedProfessionals } from '@/lib/marketplace/queries'
import { ProfessionalCard } from '@/components/shared/ProfessionalCard'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HeroSearch } from './HeroSearch'

export default async function LandingPage() {
  const [categories, featured] = await Promise.all([
    getCategoryTree(),
    getFeaturedProfessionals(6),
  ])

  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-7 px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28 sm:pb-24">
          <span className="border-border bg-card-subtle text-body inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <span className="bg-success size-1.5 rounded-full" aria-hidden="true" />
            Trusted professionals across Trinidad &amp; Tobago
          </span>

          <h1 className="text-display-2xl text-foreground max-w-3xl text-balance">
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

      {/* ── How it works ── */}
      <section className="border-border bg-card-subtle border-y">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                icon: PencilLine,
                step: '1',
                title: 'Say what you need',
                body: 'Describe the job in your own words, or browse by category and area — beauty, trades, tech, events, education and more. No sign-up needed to browse.',
              },
              {
                icon: Users,
                step: '2',
                title: 'Read real reviews',
                body: 'Every review is moderated and linked to a real job. See verified testimonials from real clients — no fake ratings, ever.',
              },
              {
                icon: Handshake,
                step: '3',
                title: 'Get in touch directly',
                body: 'Reach the professional straight on WhatsApp, phone, or email — no platform middleman, no booking fees.',
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col gap-3">
                {/* Step marker: accent-soft, not a solid accent fill — the one
                    saturated accent stays reserved for clickable actions. */}
                <div className="bg-accent-soft text-accent-ink flex size-10 items-center justify-center rounded-full">
                  <item.icon className="size-5" aria-hidden="true" />
                </div>
                <h3 className="text-foreground text-lg font-medium">
                  <span className="text-muted mr-2 font-mono text-sm tabular-nums">
                    {item.step}
                  </span>
                  {item.title}
                </h3>
                <p className="text-body text-sm">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Popular categories ── */}
      {categories.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-display-sm text-foreground">What people are booking</h2>
            <Link href="/categories" className="text-accent-ink text-sm hover:underline">
              All categories
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.slice(0, 8).map((node) => (
              <Link
                key={node.parent.slug}
                href={`/categories/${node.parent.slug}`}
                className="focus-visible:outline-ring rounded-[--radius-card] focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <Card interactive padding="compact" className="h-full">
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
            ))}
          </div>
        </section>
      )}

      {/* ── Featured supply (only when real) ── */}
      {featured.length > 0 && (
        <section className="border-border border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-display-sm text-foreground">Highly rated right now</h2>
              <Link href="/search" className="text-accent-ink text-sm hover:underline">
                Browse all
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((pro, index) => (
                <ProfessionalCard key={pro.id} data={pro} source="search" position={index} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Trust strip ── */}
      <section className="border-border bg-card-subtle border-y">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:grid-cols-3 sm:px-6">
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
          ].map((item) => (
            <div key={item.title} className="flex flex-col gap-2">
              <item.icon className="text-accent-ink size-6" aria-hidden="true" />
              <h3 className="text-foreground font-medium">{item.title}</h3>
              <p className="text-body text-sm">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pro CTA ── */}
      <section>
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6">
          <h2 className="text-display-md text-foreground text-balance">
            Run your trade like a business
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
