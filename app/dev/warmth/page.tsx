'use client'

/**
 * /dev/warmth — the D61 warmth-pass decision page.
 *
 * Renders the same marketplace sample twice: the CURRENT direction (cool
 * cyan-tinted canvas, display 500–600) beside a V1-WARMED variant (warm-white
 * canvas per V1's #F8F7F4, heavier display weight per V1's Satoshi-900 heroes).
 * Everything else — accent, cards, shadows, type family — is identical, so the
 * two variables Gregg must decide are the ONLY things that differ.
 *
 * Dev-only surface, like /dev/kit: literal values are allowed here because the
 * page's whole job is to compare candidate token values before they become law.
 * Whichever wins becomes a globals.css edit; components never change.
 */
import * as React from 'react'
import { Star, ShieldCheck, MessageCircle } from 'lucide-react'

/** The candidate canvas values under comparison. */
const VARIANTS = [
  {
    key: 'current',
    label: 'Current — cool, cyan-tinted',
    note: 'canvas #EEF1F1 · display 500/600 (the 28 Jul depth resolution as shipped)', // lexicon-ok: candidate value under comparison, dev-only page
    canvas: '#eef1f1', // lexicon-ok: candidate value under comparison, dev-only page
    subtle: '#e6eaea', // lexicon-ok: candidate value under comparison, dev-only page
    displayWeight: 550,
    headingWeight: 600,
  },
  {
    key: 'warmed',
    label: 'V1-warmed — sunlit, confident',
    note: 'canvas #F5F3EE (V1 #F8F7F4 deepened for card float) · display 800', // lexicon-ok: candidate value under comparison, dev-only page
    canvas: '#f5f3ee', // lexicon-ok: candidate value under comparison, dev-only page
    subtle: '#edeae2', // lexicon-ok: candidate value under comparison, dev-only page
    displayWeight: 800,
    headingWeight: 700,
  },
] as const

function Sample({ variant }: { variant: (typeof VARIANTS)[number] }) {
  return (
    <section
      aria-label={variant.label}
      className="rounded-[16px] border p-6 sm:p-8"
      style={{ backgroundColor: variant.canvas, borderColor: 'var(--border)' }}
    >
      {/* Hero snippet */}
      <p
        className="text-foreground font-display max-w-[16ch] text-3xl leading-[1.08] tracking-tight text-balance sm:text-4xl"
        style={{ fontWeight: variant.displayWeight }}
      >
        Whatever you need done, someone here does it well.
      </p>
      <p className="text-body mt-3 max-w-md text-sm">
        Describe your project, compare verified professionals, and reach them straight on WhatsApp.
      </p>

      {/* Professional card row */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {[
          {
            name: 'Kerry-Ann Hair Studio',
            trade: 'Hairstylist · Port of Spain',
            rating: '4.9',
            reviews: 31,
            from: 'TTD $250',
          },
          {
            name: 'Persad & Sons',
            trade: 'Plumbing · Chaguanas',
            rating: '4.6',
            reviews: 18,
            from: 'TTD $400',
          },
        ].map((pro) => (
          <article
            key={pro.name}
            className="bg-card rounded-[12px] border p-5"
            style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-e1)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  className="text-foreground font-display text-lg"
                  style={{ fontWeight: variant.headingWeight }}
                >
                  {pro.name}
                </h3>
                <p className="text-muted mt-0.5 text-xs">{pro.trade}</p>
              </div>
              <span className="text-accent-ink inline-flex items-center gap-1 text-xs font-medium">
                <ShieldCheck className="size-3.5" aria-hidden="true" /> Verified
              </span>
            </div>
            <div className="text-body mt-3 flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Star className="text-warning size-3.5 fill-current" aria-hidden="true" />
                {pro.rating} · {pro.reviews} reviews
              </span>
              <span className="text-muted font-mono text-xs tabular-nums">from {pro.from}</span>
            </div>
            <button
              type="button"
              className="bg-accent text-accent-foreground mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] text-sm font-medium"
            >
              <MessageCircle className="size-4" aria-hidden="true" /> Chat on WhatsApp
            </button>
          </article>
        ))}
      </div>

      {/* Inset well — where card-subtle shows */}
      <div
        className="mt-4 rounded-[12px] p-4 text-center"
        style={{ backgroundColor: variant.subtle }}
      >
        <p className="text-muted text-xs">
          Inset well / input surface at this temperature ({variant.note})
        </p>
      </div>
    </section>
  )
}

export default function WarmthPage() {
  return (
    <div className="bg-background min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-foreground font-display text-2xl font-semibold tracking-tight">
          The warmth decision (D61)
        </h1>
        <p className="text-body mt-2 max-w-2xl text-sm text-pretty">
          Same components, same accent, same shadows. Two variables differ: canvas temperature and
          display weight. Pick a side — or name a mix (warm canvas with current weight, or the
          reverse). One word back is enough: <em>current</em>, <em>warmed</em>, or the mix.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {VARIANTS.map((variant) => (
            <div key={variant.key}>
              <h2 className="text-foreground mb-3 font-mono text-sm tracking-wide uppercase">
                {variant.label}
              </h2>
              <Sample variant={variant} />
            </div>
          ))}
        </div>

        <p className="text-muted mt-8 text-xs text-pretty">
          Whichever wins is a token edit in globals.css — no component changes. Dark mode is
          unaffected by canvas temperature (its surfaces already sit deep); display weight would
          apply to both themes.
        </p>
      </div>
    </div>
  )
}
