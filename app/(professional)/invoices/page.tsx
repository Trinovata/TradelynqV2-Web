import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Receipt } from 'lucide-react'
import { requireProfessional } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { getProfessionalInvoices } from '@/lib/invoices/queries'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/States'
import { formatTTD, formatDateShort } from '@/lib/utils/format'
import { InvoiceComposerButton } from './InvoiceComposer'

export const metadata: Metadata = { title: 'Invoices' }

// Money-adjacent, per-professional, status changes on payment — never cache.
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}

export default async function InvoicesPage() {
  const access = await requireProfessional()
  if (!access.ok) redirect(loginRedirect('/invoices'))

  const invoices = await getProfessionalInvoices(access.supabase)

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground font-display text-2xl tracking-tight">Invoices</h1>
          <p className="text-muted mt-1 text-sm">
            Bill a customer, send the link, and track payment — settled directly between you.
          </p>
        </div>
        <InvoiceComposerButton />
      </header>

      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          heading="No invoices yet"
          body="Create an invoice — add line items, send the link, and track payment here."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {invoices.map((inv) => (
            <li
              key={inv.id}
              className="border-border bg-card flex items-center justify-between gap-4 rounded-[--radius-card] border p-4"
            >
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-medium">
                  {inv.customerName}{' '}
                  <span className="text-muted font-mono text-xs">· {inv.invoiceNumber}</span>
                </p>
                <p className="text-muted mt-0.5 text-xs">
                  {formatDateShort(inv.createdAt)}
                  {inv.dueDate ? ` · due ${formatDateShort(inv.dueDate)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-foreground font-mono text-sm tabular-nums">
                  {formatTTD(inv.totalTtd)}
                </span>
                <Badge status={inv.status}>{STATUS_LABEL[inv.status] ?? inv.status}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
