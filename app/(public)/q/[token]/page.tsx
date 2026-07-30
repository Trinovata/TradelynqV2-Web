import type { Metadata } from 'next'
import { getQuoteByToken } from '@/lib/documents/tokens'
import {
  DocumentFooter,
  DocumentLetterhead,
  DocumentLineItems,
} from '@/components/shared/DocumentChrome'
import { TokenInvalid } from '@/components/shared/TokenInvalid'
import { QuoteActions } from './QuoteActions'

/**
 * Public quote page /q/[token] (playbook S093, spec v2/03 §3.13, deck §14.1).
 * Minimal document chrome — no navbar, no auth; the token is the capability.
 * force-dynamic: a document page must reflect the response that was just
 * recorded, and viewed_at stamping is a per-request side effect.
 */
export const dynamic = 'force-dynamic'

type Params = { token: string }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token } = await params
  const quote = await getQuoteByToken(token)
  return {
    title: quote ? `Quote from ${quote.professional.name} | TradeLynq` : 'Quote | TradeLynq',
    robots: { index: false, follow: false },
  }
}

export default async function QuoteTokenPage({ params }: { params: Promise<Params> }) {
  const { token } = await params
  const quote = await getQuoteByToken(token)
  if (!quote) return <TokenInvalid />

  const quoteNumber = quote.id.slice(0, 8)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <div className="border-border bg-card rounded-[--radius-card] border p-6 sm:p-8">
        <DocumentLetterhead
          professionalName={quote.professional.name}
          avatarUrl={quote.professional.avatarUrl}
          branding={quote.professional.branding}
        />

        <div className="mt-8 flex items-baseline justify-between">
          <h1 className="text-foreground font-display text-2xl tracking-tight">Quote</h1>
          <p className="text-muted font-mono text-sm tabular-nums">Quote #{quoteNumber}</p>
        </div>
        <p className="text-body mt-1 text-sm">For {quote.customerName}</p>
        {quote.validUntil && (
          <p className="text-muted mt-0.5 text-sm">
            Valid until{' '}
            {new Date(quote.validUntil).toLocaleDateString('en-TT', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}

        <div className="mt-6">
          <DocumentLineItems
            items={quote.lineItems}
            subtotalTtd={quote.subtotalTtd}
            vatPercent={quote.vatPercent}
            vatAmountTtd={quote.vatAmountTtd}
            totalTtd={quote.totalTtd}
            totalsLabel="Total"
          />
        </div>

        {quote.notes && (
          <p className="text-body border-border mt-4 border-t pt-4 text-sm whitespace-pre-line">
            {quote.notes}
          </p>
        )}

        <div className="mt-8">
          <QuoteActions
            token={token}
            professionalName={quote.professional.name}
            professionalWhatsapp={quote.professional.whatsapp}
            expired={quote.expired}
            expiredAt={quote.validUntil}
            initialResponse={
              quote.respondedAt ? { status: quote.status, respondedAt: quote.respondedAt } : null
            }
          />
        </div>

        <DocumentFooter branding={quote.professional.branding} />
      </div>
    </div>
  )
}
