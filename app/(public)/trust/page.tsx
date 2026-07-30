import type { Metadata } from 'next'
import Link from 'next/link'
import { VerificationLadder } from '@/components/shared/VerificationLadder'

/**
 * Trust & safety (playbook S089, spec v2/03 §3.10, copy deck §11.2 — strings
 * verbatim; "no blobs, no gradient" is the deck's own design note).
 *
 * The deck writes headings for sections 3 (content policy) and 4 (if
 * something goes wrong) but no bodies — INTERIM-AUTHORED here, grounded in
 * the shipped moderation/dispute behaviour and the legal set; FLAGGED for
 * deck ratification.
 */
export const metadata: Metadata = {
  title: 'Trust & safety | TradeLynq',
  description:
    'How TradeLynq verifies professionals, moderates reviews, and handles disputes — the promises behind every badge.',
}

const LADDER = [
  { title: 'ID Verified', body: 'We confirm the professional is who they say they are.' },
  { title: 'Insured', body: 'We check that stated insurance is valid and current.' },
  { title: 'Fully Verified', body: 'Identity and insurance both confirmed.' },
]

export default function TrustPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-foreground font-display text-3xl tracking-tight">Trust is the product</h1>

      <section className="mt-10">
        <h2 className="text-foreground font-medium">The verification ladder</h2>
        <div className="mt-4">
          <VerificationLadder steps={LADDER} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-foreground font-medium">How we moderate reviews</h2>
        <p className="text-body mt-2 text-sm leading-relaxed">
          Every review is checked by our team before it appears. Reviews stay light-touch and
          genuine — we step in only for fraud or abuse. A professional can dispute a review they
          believe is unfair; we contact the reviewer for substantiation, and the review either
          stands or is removed.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-foreground font-medium">Our content policy, in short</h2>
        {/* INTERIM-AUTHORED (deck heading only) — grounded in the legal set. */}
        <p className="text-body mt-2 text-sm leading-relaxed">
          Real work, honestly presented. Listings must describe services the professional actually
          offers; portfolio images must be their own work; reviews must come from genuine customers.
          Content that misleads, harasses, or infringes is removed, and repeat abuse ends the
          account. The full rules live in our{' '}
          <Link href="/legal" className="text-foreground underline underline-offset-4">
            legal pages
          </Link>
          .
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-foreground font-medium">If something goes wrong</h2>
        {/* INTERIM-AUTHORED (deck heading only) — the dispute path as shipped. */}
        <p className="text-body mt-2 text-sm leading-relaxed">
          Tell us. Report the professional, the review, or the post — or message us directly — and
          our team will look at it against our policies. Disputes between customers and
          professionals get a named case: we hear both sides, keep a record, and give you an answer
          rather than silence.
        </p>
        <Link
          href="/support"
          className="text-foreground mt-3 inline-block text-sm font-medium underline underline-offset-4"
        >
          Report a concern
        </Link>
      </section>
    </div>
  )
}
