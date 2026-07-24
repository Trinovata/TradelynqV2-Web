import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Inbox } from 'lucide-react'
import { requireCustomer } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { getCustomerEnquiries } from '@/lib/enquiries/queries'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { formatRelativeTime, formatDateShort } from '@/lib/utils/format'
import type { Enums } from '@/types/database'

export const metadata: Metadata = {
  title: 'Your enquiries',
}

const STATUS_LABEL: Record<Enums<'enquiry_status'>, string> = {
  pending: 'Sent',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  declined: 'Declined',
}

/**
 * /home/enquiries — the customer's side of the loop (spec v2/04 §4.2).
 *
 * Every professional a customer has reached, and where each one stands. Sent
 * shows as awaiting reply; accepted/declined reflect the professional's answer
 * (a declined enquiry surfaces its reason verbatim, per the review-fair rule).
 * Nests under /home, per the route decision that keeps the professional
 * workspace on the flat paths.
 */
export default async function CustomerEnquiriesPage() {
  const ctx = await requireCustomer()
  if (!ctx.ok) redirect(loginRedirect('/home/enquiries'))

  const { rows, error } = await getCustomerEnquiries(ctx.supabase)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <Link
        href="/home"
        className="text-muted hover:text-body mb-5 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Home
      </Link>

      <header className="mb-6">
        <h1 className="text-foreground font-display text-3xl tracking-tight">Your enquiries</h1>
        <p className="text-muted mt-1 text-sm">
          Everyone you&rsquo;ve reached, and where it stands.
        </p>
      </header>

      {error ? (
        <ErrorState body="We couldn't load your enquiries just now. Try again in a moment." />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          heading="No enquiries yet"
          body="Find a professional and describe what you need — your conversations will show here."
          action={{ label: 'Find a professional', href: '/search' }}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const proName = row.professional?.business_name ?? 'A professional'
            const proHref = row.professional?.slug
              ? `/professionals/${row.professional.slug}`
              : null
            return (
              <li key={row.id} className="border-border bg-card rounded-[--radius-card] border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {proHref ? (
                      <Link href={proHref} className="text-foreground font-medium hover:underline">
                        {proName}
                      </Link>
                    ) : (
                      <span className="text-foreground font-medium">{proName}</span>
                    )}
                    <p className="text-muted mt-0.5 text-xs">
                      Sent {formatRelativeTime(row.created_at)}
                      {row.preferred_date && (
                        <> · preferred {formatDateShort(row.preferred_date)}</>
                      )}
                    </p>
                  </div>
                  <Badge status={row.status}>{STATUS_LABEL[row.status]}</Badge>
                </div>

                <p className="text-body mt-2 line-clamp-2 text-sm">{row.description}</p>

                {row.status === 'declined' && row.declined_reason && (
                  <p className="text-muted border-border mt-3 border-t pt-3 text-sm">
                    <span className="text-body font-medium">Reply:</span> {row.declined_reason}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-8">
        <Button asChild variant="secondary" size="sm">
          <Link href="/search">Find another professional</Link>
        </Button>
      </div>
    </div>
  )
}
