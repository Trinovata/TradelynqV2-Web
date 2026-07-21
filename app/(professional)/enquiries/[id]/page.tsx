import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireProfessional } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { getEnquiryInbox, type EnquiryRow } from '@/lib/enquiries/queries'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/States'
import { formatTTD, formatDate, formatRelativeTime } from '@/lib/utils/format'
import type { Enums } from '@/types/database'
import { EnquiryActions } from './EnquiryActions'

export const metadata: Metadata = {
  title: 'Enquiry',
}

const STATUS_LABEL: Record<Enums<'enquiry_status'>, string> = {
  pending: 'New',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  declined: 'Declined',
}

const CONTACT_LABEL: Record<Enums<'contact_preference'>, string> = {
  whatsapp: 'WhatsApp',
  call: 'Call',
  email: 'Email',
}

/**
 * /enquiries/[id] — a single enquiry, read-only (spec 05 §5.2).
 *
 * This slice renders the request in full so the professional can read what's
 * being asked. The state-machine actions — accept, decline, send quote, the AI
 * reply drafts — are the next block (they need write paths and the contact
 * reveal); this page is honest about that rather than showing buttons that do
 * nothing. It reuses the inbox primitive and selects the one row, so there is no
 * second data path to keep in step.
 */
export default async function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireProfessional()
  if (!ctx.ok) redirect(loginRedirect('/enquiries'))

  const { id } = await params
  const { rows, error } = await getEnquiryInbox(ctx.supabase)

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <ErrorState body="We couldn't load this enquiry just now. Try again in a moment." />
      </div>
    )
  }

  const enquiry = rows.find((row) => row.id === id)
  if (!enquiry) notFound()

  const name = enquiry.customer_first_name ?? 'Customer'

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href="/enquiries"
        className="text-muted hover:text-body mb-5 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Enquiries
      </Link>

      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground font-display text-2xl tracking-tight">{name}</h1>
          <p className="text-muted mt-1 text-sm">Received {formatRelativeTime(enquiry.created_at)}</p>
        </div>
        <Badge status={enquiry.status}>{STATUS_LABEL[enquiry.status]}</Badge>
      </header>

      <Card className="mb-4">
        <h2 className="text-muted text-xs font-medium tracking-[0.1em] uppercase">The request</h2>
        <p className="text-body mt-2 text-sm whitespace-pre-line">{enquiry.description}</p>

        <dl className="border-border mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 text-sm">
          <div>
            <dt className="text-muted text-xs">Preferred contact</dt>
            <dd className="text-body">{CONTACT_LABEL[enquiry.contact_preference]}</dd>
          </div>
          {enquiry.preferred_date && (
            <div>
              <dt className="text-muted text-xs">Preferred date</dt>
              <dd className="text-body font-mono">{formatDate(enquiry.preferred_date)}</dd>
            </div>
          )}
        </dl>
      </Card>

      <div className="mb-4">
        <EnquiryActions enquiryId={enquiry.id} status={enquiry.status} firstName={name} />
      </div>

      <EnquiryOutcome enquiry={enquiry} />

      <p className="text-muted mt-6 text-xs">
        Sending quotes and replying on WhatsApp arrive with the Quotes tool.
      </p>
    </div>
  )
}

/** State-specific read-out: the case log once there is one, or the decline reason. */
function EnquiryOutcome({ enquiry }: { enquiry: EnquiryRow }) {
  if (enquiry.status === 'declined' && enquiry.declined_reason) {
    return (
      <Card>
        <h2 className="text-muted text-xs font-medium tracking-[0.1em] uppercase">Declined</h2>
        <p className="text-body mt-2 text-sm">{enquiry.declined_reason}</p>
      </Card>
    )
  }

  const hasNotes = enquiry.agreed_price_ttd != null || enquiry.agreed_timeline || enquiry.scope_note
  if (!hasNotes) return null

  return (
    <Card>
      <h2 className="text-muted text-xs font-medium tracking-[0.1em] uppercase">Job notes</h2>
      <dl className="mt-2 flex flex-col gap-3 text-sm">
        {enquiry.agreed_price_ttd != null && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Agreed price</dt>
            <dd className="text-foreground font-mono">{formatTTD(enquiry.agreed_price_ttd)}</dd>
          </div>
        )}
        {enquiry.agreed_timeline && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Timeline</dt>
            <dd className="text-body">{enquiry.agreed_timeline}</dd>
          </div>
        )}
        {enquiry.scope_note && (
          <div>
            <dt className="text-muted">Scope</dt>
            <dd className="text-body mt-1 whitespace-pre-line">{enquiry.scope_note}</dd>
          </div>
        )}
      </dl>
    </Card>
  )
}
