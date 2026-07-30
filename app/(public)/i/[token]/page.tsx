import type { Metadata } from 'next'
import { getInvoiceByToken } from '@/lib/documents/tokens'
import {
  DocumentFooter,
  DocumentLetterhead,
  DocumentLineItems,
} from '@/components/shared/DocumentChrome'
import { TokenInvalid } from '@/components/shared/TokenInvalid'
import { InvoiceActions } from './InvoiceActions'

/**
 * Public invoice page /i/[token] (playbook S093, spec v2/03 §3.13, deck
 * §14.2). /invoice/[token] aliases here. Payment instructions are the
 * off-app set (bank transfer / WiPay / cash) — the professional's own
 * details arrive with the S111 invoice composer; until then the block names
 * the mechanism and points at WhatsApp for specifics, honestly.
 */
export const dynamic = 'force-dynamic'

type Params = { token: string }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token } = await params
  const invoice = await getInvoiceByToken(token)
  return {
    title: invoice
      ? `Invoice from ${invoice.professional.name} | TradeLynq`
      : 'Invoice | TradeLynq',
    robots: { index: false, follow: false },
  }
}

export default async function InvoiceTokenPage({ params }: { params: Promise<Params> }) {
  const { token } = await params
  const invoice = await getInvoiceByToken(token)
  if (!invoice) return <TokenInvalid />

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <div className="border-border bg-card rounded-[--radius-card] border p-6 sm:p-8">
        <DocumentLetterhead
          professionalName={invoice.professional.name}
          avatarUrl={invoice.professional.avatarUrl}
          branding={invoice.professional.branding}
        />

        <div className="mt-8 flex items-baseline justify-between">
          <h1 className="text-foreground font-display text-2xl tracking-tight">Invoice</h1>
          <p className="text-muted font-mono text-sm tabular-nums">
            Invoice #{invoice.invoiceNumber}
          </p>
        </div>
        <p className="text-body mt-1 text-sm">For {invoice.customerName}</p>
        {invoice.dueDate && (
          <p className={`mt-0.5 text-sm ${invoice.overdue ? 'text-destructive' : 'text-muted'}`}>
            Due{' '}
            {new Date(invoice.dueDate).toLocaleDateString('en-TT', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}

        <div className="mt-6">
          <DocumentLineItems
            items={invoice.lineItems}
            subtotalTtd={invoice.subtotalTtd}
            vatPercent={invoice.vatPercent}
            vatAmountTtd={invoice.vatAmountTtd}
            totalTtd={invoice.totalTtd}
            totalsLabel="Amount due"
          />
        </div>

        {invoice.notes && (
          <p className="text-body border-border mt-4 border-t pt-4 text-sm whitespace-pre-line">
            {invoice.notes}
          </p>
        )}

        <div className="mt-8">
          <InvoiceActions token={token} initialAcknowledgedAt={invoice.acknowledgedAt} />
        </div>

        <section className="border-border mt-6 border-t pt-4">
          <h2 className="text-foreground text-sm font-medium">How to pay</h2>
          <p className="text-body mt-1 text-sm">
            {invoice.professional.name} accepts bank transfer, WiPay, or cash. Confirm the details
            with them on WhatsApp before paying — payment happens directly between you.
          </p>
        </section>

        <DocumentFooter branding={invoice.professional.branding} />
      </div>
    </div>
  )
}
