/**
 * Professional storefront (playbook S081, spec v2/03 §3.4 — the flagship).
 *
 * The page a search leads to and the reason a professional lists at all. Server
 * component: it fetches everything up front so the first paint is the storefront,
 * and it renders structured data (JSON-LD) so the same content that persuades a
 * person also earns the search result. Contact details are absent from the public
 * data by construction — the reveal gate (S083) grants them through
 * `getViewerGateState` (page load, existing connection) or `POST /api/connections`
 * (the gauntlet in the sticky action rail).
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin, ShieldCheck, BadgeCheck, Clock } from 'lucide-react'
import { getProfessionalBySlug, getViewerGateState } from '@/lib/marketplace/queries'
import { isProfessionalSaved } from '@/lib/marketplace/saved'
import { createClient } from '@/lib/supabase/server'
import { SaveButton } from '@/components/shared/SaveButton'
import { BusinessHours } from '@/components/shared/BusinessHours'
import { PortfolioGallery } from '@/components/shared/PortfolioGallery'
import { BlurFade } from '@/components/ui/blur-fade'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { ReviewCard, DistributionBar } from '@/components/shared/ReviewCard'
import { EmptyState } from '@/components/ui/States'
import { formatTTD, formatResponseTime } from '@/lib/utils/format'
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

  // Auth + gate state are read here (server) and handed to the action rail as
  // props, so the first paint already shows a returning customer their revealed
  // rail — no client-side session fetch, no flash of the locked state. Contact
  // details enter the payload ONLY when getViewerGateState confirms a
  // connection row (D13: API-redacted until the server verifies reveal).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isSignedIn = user !== null
  const [gate, initialSaved] = isSignedIn
    ? await Promise.all([getViewerGateState(pro.id), isProfessionalSaved(pro.id)])
    : [null, false]

  // Save is a customer affordance. Signed-out viewers keep the button (it
  // routes to login); a signed-in professional or admin loses it entirely
  // rather than being offered an action the API answers with FORBIDDEN_ROLE.
  const canSave = !isSignedIn || (gate?.isCustomer ?? false)

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
        {/* The storefront settles in on load — one calm reveal so the shop
            window feels considered, not assembled. */}
        <BlurFade className="flex flex-col gap-8">
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
                {/* Mobile save mount (S084): the bottom bar spec (§5.9) lists
                    only reveal + quote, so the save toggle lives up here.
                    Desktop uses the rail's instance — the two are never
                    visible at the same breakpoint. */}
                {canSave && (
                  <SaveButton
                    professionalId={pro.id}
                    name={pro.name}
                    isSignedIn={isSignedIn}
                    initialSaved={initialSaved}
                    className="ml-auto lg:hidden"
                  />
                )}
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
                {/* RP2 (D57): median accepted-response over 90 days, rendered
                    only at sample ≥ 5 — the query returns null below that. */}
                {pro.responseTime && (
                  <Badge variant="neutral">
                    <Clock className="size-3.5" aria-hidden="true" />
                    Usually responds in ~{formatResponseTime(pro.responseTime.medianMinutes)}
                  </Badge>
                )}
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

          {/* Portfolio (§3.4 section 4) — omitted entirely at zero images,
              never an empty grid. */}
          {pro.portfolio.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-foreground font-medium">Portfolio</h2>
              <PortfolioGallery images={pro.portfolio} name={pro.name} />
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
              // Deck §5.6 "No reviews" — one string, split at its em-dash to
              // fit EmptyState's heading/body slots. The previous body was
              // invented copy and said "clients" (canon: customers).
              <EmptyState
                icon={ShieldCheck}
                heading="No reviews yet"
                body="This professional is new on TradeLynq."
              />
            )}
          </section>

          {/* Business hours (§3.4 section 6) — Port of Spain time. */}
          {pro.businessHours && (
            <section className="flex flex-col gap-3">
              <h2 className="text-foreground font-medium">Business hours</h2>
              <BusinessHours hours={pro.businessHours} />
            </section>
          )}
        </BlurFade>

        {/* ── Sticky action rail (desktop) / bottom bar (mobile) ── */}
        <StorefrontActions
          professionalId={pro.id}
          name={pro.name}
          firstName={pro.ownerFirstName}
          category={pro.category?.name ?? null}
          fromPrice={fromPrice}
          isSignedIn={isSignedIn}
          initialRevealed={gate?.revealed ?? false}
          initialContact={gate?.contact ?? null}
          initialSaved={initialSaved}
          canSave={canSave}
          connectionCount={gate?.connectionCount ?? 0}
          kycStatus={gate?.kycStatus ?? null}
          websiteUrl={pro.websiteUrl}
          instagramHandle={pro.instagramHandle}
        />
      </div>
    </div>
  )
}
