import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { FileText } from 'lucide-react'
import { requireProfessional } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { getProfessionalQuotes } from '@/lib/quotes/queries'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/States'
import { formatTTD, formatDateShort } from '@/lib/utils/format'
import { QuoteComposerButton } from './QuoteComposer'

export const metadata: Metadata = { title: 'Quotes' }

// Money-adjacent, per-professional, and status changes when a customer
// responds — never cache (the caching directive: authed workspace money data
// is always fresh).
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  converted: 'Converted',
}

export default async function QuotesPage() {
  const access = await requireProfessional()
  if (!access.ok) redirect(loginRedirect('/quotes'))

  const quotes = await getProfessionalQuotes(access.supabase)

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground font-display text-2xl tracking-tight">Quotes</h1>
          <p className="text-muted mt-1 text-sm">
            Build an estimate, send the link, and it converts straight into a job when accepted.
          </p>
        </div>
        <QuoteComposerButton />
      </header>

      {quotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          heading="No quotes yet"
          body="Create your first quote — add line items, send the link, and track the response here."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {quotes.map((q) => (
            <li
              key={q.id}
              className="border-border bg-card flex items-center justify-between gap-4 rounded-[--radius-card] border p-4"
            >
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-medium">{q.customerName}</p>
                <p className="text-muted mt-0.5 text-xs">
                  {formatDateShort(q.createdAt)}
                  {q.validUntil ? ` · valid to ${formatDateShort(q.validUntil)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-foreground font-mono text-sm tabular-nums">
                  {formatTTD(q.totalTtd)}
                </span>
                <Badge status={q.status}>{STATUS_LABEL[q.status] ?? q.status}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
