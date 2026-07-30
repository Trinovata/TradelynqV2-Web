import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireCustomer } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { getCustomerEnquiryDetail, enquiryTimeline } from '@/lib/enquiries/queries'
import { Badge } from '@/components/ui/Badge'
import { Timeline } from '@/components/shared/Timeline'
import { formatDateShort } from '@/lib/utils/format'
import type { Enums } from '@/types/database'
import { EnquiryDetailActions } from './EnquiryDetailActions'

export const metadata: Metadata = { title: 'Enquiry' }

const STATUS_LABEL: Record<Enums<'enquiry_status'>, string> = {
  pending: 'Sent',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  declined: 'Declined',
}

/**
 * /home/enquiries/[id] — one enquiry, its status timeline, and the single
 * action its state allows (spec 04 §4.2). A not-yours or unknown id resolves
 * to the list rather than a 404 wall — friendlier, and it leaks nothing (RLS
 * already returned null for a row the caller cannot see).
 */
export default async function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireCustomer()
  if (!access.ok) redirect(loginRedirect('/home/enquiries'))

  const { id } = await params
  const enquiry = await getCustomerEnquiryDetail(access.supabase, id)
  if (!enquiry) redirect('/home/enquiries')

  const proName = enquiry.professional?.business_name ?? 'A professional'
  const proHref = enquiry.professional?.slug ? `/professionals/${enquiry.professional.slug}` : null
  const events = enquiryTimeline(enquiry)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/home/enquiries"
        className="text-body hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All enquiries
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-foreground font-display text-2xl tracking-tight">
            {proHref ? (
              <Link href={proHref} className="hover:underline">
                {proName}
              </Link>
            ) : (
              proName
            )}
          </h1>
          <p className="text-muted mt-0.5 text-sm">Sent {formatDateShort(enquiry.created_at)}</p>
        </div>
        <Badge status={enquiry.status}>{STATUS_LABEL[enquiry.status]}</Badge>
      </header>

      <section className="border-border bg-card mt-6 rounded-[--radius-card] border p-5">
        <h2 className="text-muted text-xs font-medium">What you asked for</h2>
        <p className="text-body mt-2 text-sm whitespace-pre-line">{enquiry.description}</p>
        {enquiry.preferred_date && (
          <p className="text-muted mt-3 text-sm">
            Preferred date:{' '}
            <span className="text-body font-mono tabular-nums">
              {formatDateShort(enquiry.preferred_date)}
            </span>
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-foreground font-medium">Progress</h2>
        <div className="mt-4">
          <Timeline events={events} />
        </div>
      </section>

      <div className="mt-8">
        <EnquiryDetailActions
          enquiryId={enquiry.id}
          status={enquiry.status}
          professionalName={proName}
          professionalWhatsapp={enquiry.professional?.contact_whatsapp ?? null}
          hasReview={enquiry.hasReview}
        />
      </div>
    </div>
  )
}
