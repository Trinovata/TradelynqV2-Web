import type { Metadata } from 'next'
import Link from 'next/link'

/**
 * Customer guide (playbook S089, spec v2/03 §3.10, copy deck §11.1 —
 * canonical; /for-customers and /homeowner-guide 301 here via next.config).
 *
 * The deck writes bodies for sections 3 (verification) and 6 (safety) only.
 * Sections 1/2/4/5 are INTERIM-AUTHORED here, grounded strictly in shipped
 * behaviour (search + filters, review moderation + verified-job labels, the
 * two-free-reveals gate, quote requests) — FLAGGED for deck ratification;
 * replace verbatim when the deck carries them.
 */
export const metadata: Metadata = {
  title: 'How TradeLynq works for customers | TradeLynq',
  description:
    'How to search, what our verification badges mean, how reviews work, and how to stay safe when you hire on TradeLynq.',
}

const SECTIONS: { id: string; title: string; body: string; interim?: boolean }[] = [
  {
    id: 'searching',
    title: 'Searching for a professional',
    interim: true,
    body: 'Type what you need — a trade, a service, or a name — and results appear as you type. Narrow by category or area, and sort by rating when you want the strongest options first. Every listing you see is a real, active professional.',
  },
  {
    id: 'reviews',
    title: 'Reading reviews',
    interim: true,
    body: 'Reviews come from customers and are checked by our team before they appear. A Verified job label means the review is tied to work completed through TradeLynq. The rating summary shows the spread, not just the average — read a few before you decide.',
  },
  {
    id: 'verification',
    title: 'What verification means',
    body: "A green badge means we checked something real. ID Verified means we confirmed the professional's identity. Insured means they showed valid coverage. TradeLynq Verified means both. Registered Business means the company is legally registered.",
  },
  {
    id: 'contacting',
    title: 'Contacting a professional',
    interim: true,
    body: 'Open a storefront and tap Reveal contact info to see their phone and WhatsApp. Your first two reveals are free; after that, a short identity check keeps the marketplace safe for everyone. Once revealed, a contact stays revealed.',
  },
  {
    id: 'quotes',
    title: 'Requesting a quote',
    interim: true,
    body: 'Use Request a quote on any storefront to describe the job once — what, where, and when. The professional replies with a price you can accept or decline in your enquiries, so the whole conversation stays in one place.',
  },
  {
    id: 'safety',
    title: 'Staying safe',
    body: "Meet in a safe, public place for first meetings where possible. Agree the scope and price in writing before work starts. Keep your conversation on WhatsApp so there's a record. Report anything that feels off.",
  },
]

export default function CustomerGuidePage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
        <nav aria-label="On this page" className="mb-8 lg:mb-0">
          <div className="lg:sticky lg:top-24">
            <h1 className="text-foreground font-display text-2xl tracking-tight lg:text-xl">
              Using TradeLynq as a customer
            </h1>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-body hover:text-foreground transition-colors"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <article className="flex flex-col gap-10">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-foreground font-medium">{section.title}</h2>
              <p className="text-body mt-2 text-sm leading-relaxed">{section.body}</p>
              {section.id === 'safety' && (
                <Link
                  href="/support"
                  className="text-foreground mt-3 inline-block text-sm font-medium underline underline-offset-4"
                >
                  Report a concern
                </Link>
              )}
            </section>
          ))}
        </article>
      </div>
    </div>
  )
}
