/**
 * Professional storefront (playbook S081, spec v2/03 §3.4 — the flagship).
 *
 * The page a search leads to and the reason a professional lists at all. Server
 * component: it fetches everything up front so the first paint is the storefront,
 * and it renders structured data (JSON-LD) so the same content that persuades a
 * person also earns the search result. Contact details are absent from the data
 * by construction — the reveal gate (S083) grants them through a separate path;
 * the sticky action rail is where that gate will fire.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin, ShieldCheck, BadgeCheck } from 'lucide-react'
import { getProfessionalBySlug } from '@/lib/marketplace/queries'
import { createClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { ReviewCard, DistributionBar } from '@/components/shared/ReviewCard'
import { EmptyState } from '@/components/ui/States'
import { formatTTD } from '@/lib/utils/format'
import { StorefrontActions } from './StorefrontActions'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const pro = await getProfessionalBySlug(slug)
  if (!pro) return { title: 'Professional not found' }
  const where = pro.areas[0] ? ` in ${pro.areas[0]}` : ''
  return {
    title: `${pro.name} — ${pro.category?.name ?? 'Professional'}${where}`,
    description:
      pro.tagline ?? `${pro.name} on TradeLynq — verified, reviewed, reachable directly.`,
  }
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pro = await getProfessionalBySlug(slug)
  if (!pro) notFound()

  // Auth state is read here (server) and handed to the action rail as a prop, so
  // the CTA can branch without a client-side session fetch. The reveal gate (S083)
  // is not built yet: a signed-out visitor is sent to sign in (the gate resumes
  // there), while a signed-in user must NOT be bounced to /login — that page sees
  // them authenticated and sends them straight back, a loop that reads as a dead CTA.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isSignedIn = user !== null

  const priced = pro.services.filter((s) => typeof s.price_ttd === 'number')
  const fromPrice = priced.length ? Math.min(...priced.map((s) => s.price_ttd as number)) : null

  // JSON-LD. aggregateRating only when the D40 threshold is met — Google penalises
  // a rating asserted on too few reviews, and so would a careful customer.
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: pro.name,
    ...(pro.tagline ? { description: pro.tagline } : {}),
    ...(pro.areas.length ? { areaServed: pro.areas } : {}),
    ...(pro.rating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: pro.rating.average,
            reviewCount: pro.rating.count,
          },
        }
      : {}),
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <script
        type="application/ld+json"
        // The payload is our own structured data, not user HTML.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          ...(pro.category
            ? [{ label: pro.category.name, href: `/search?q=${pro.category.slug}` }]
            : []),
          { label: pro.name },
        ]}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* ── Main column ── */}
        <div className="flex flex-col gap-8">
          {/* Identity header */}
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Avatar
              src={pro.avatarUrl}
              alt={pro.name}
              name={pro.name}
              size={96}
              verified={pro.verification.fullyVerified}
            />
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-display-sm text-foreground">{pro.name}</h1>
              </div>
              {pro.category && <p className="text-body text-sm">{pro.category.name}</p>}
              {pro.areas.length > 0 && (
                <p className="text-muted inline-flex items-center gap-1.5 text-sm">
                  <MapPin className="size-4" aria-hidden="true" />
                  {pro.areas.slice(0, 3).join(' · ')}
                  {pro.areas.length > 3 ? ` +${pro.areas.length - 3}` : ''}
                </p>
              )}
              <div className="mt-1 flex flex-wrap gap-2">
                {pro.verification.fullyVerified && (
                  <Badge variant="verified">
                    <BadgeCheck className="size-3.5" aria-hidden="true" />
                    TradeLynq Verified
                  </Badge>
                )}
                {pro.verification.idVerified && !pro.verification.fullyVerified && (
                  <Badge variant="complete">ID verified</Badge>
                )}
                {pro.verification.insured && (
                  <Badge variant="complete">
                    <ShieldCheck className="size-3.5" aria-hidden="true" />
                    Insured
                  </Badge>
                )}
                {pro.track === 'registered' && <Badge variant="registered">Registered</Badge>}
                {pro.track === 'student' && <Badge variant="student">Student</Badge>}
              </div>
            </div>
          </header>

          {pro.tagline && <p className="text-foreground text-lg text-pretty">{pro.tagline}</p>}

          {pro.bio && (
            <section className="flex flex-col gap-2">
              <h2 className="text-foreground font-medium">About</h2>
              <p className="text-body text-sm leading-relaxed whitespace-pre-line">{pro.bio}</p>
            </section>
          )}

          {/* Services */}
          {pro.services.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-foreground font-medium">Services</h2>
              <ul className="divide-border divide-y">
                {pro.services.map((service, index) => (
                  <li key={index} className="flex items-baseline justify-between gap-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-foreground text-sm font-medium">{service.name}</span>
                      {service.description && (
                        <span className="text-muted text-xs">{service.description}</span>
                      )}
                    </div>
                    {typeof service.price_ttd === 'number' && (
                      <span className="text-foreground shrink-0 font-mono text-sm tabular-nums">
                        {formatTTD(service.price_ttd)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Reviews */}
          <section className="flex flex-col gap-4">
            <h2 className="text-foreground font-medium">Reviews</h2>
            {pro.reviews.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
                <DistributionBar
                  distribution={pro.distribution}
                  average={pro.rating?.average ?? null}
                />
                <div className="flex flex-col gap-3">
                  {pro.reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={ShieldCheck}
                heading="No reviews yet"
                body="This professional is new to TradeLynq. Reviews appear here once clients leave verified feedback."
              />
            )}
          </section>
        </div>

        {/* ── Sticky action rail (desktop) / bottom bar (mobile) ── */}
        <StorefrontActions
          professionalId={pro.id}
          name={pro.name}
          category={pro.category?.name ?? null}
          fromPrice={fromPrice}
          isSignedIn={isSignedIn}
        />
      </div>
    </div>
  )
}
