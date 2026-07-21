import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { formatDateShort } from '@/lib/utils/format'
import type { EnquiryRow } from '@/lib/enquiries/queries'
import type { Enums } from '@/types/database'

/**
 * One enquiry, as a list row (spec 05 §5.1).
 *
 * Row anatomy: customer first name · description clamp · source chip (manual
 * leads only) · preferred date. A status badge and, while a pending enquiry
 * waits, a waiting-time chip that turns amber past 24h — the one place the list
 * nudges rather than just informs.
 */

/** Manual-lead sources carry a chip; platform enquiries don't need labelling. */
const SOURCE_LABEL: Partial<Record<Enums<'job_source'>, string>> = {
  whatsapp: 'WhatsApp',
  phone: 'Phone',
  walk_in: 'Walk-in',
}

const STATUS_LABEL: Record<Enums<'enquiry_status'>, string> = {
  pending: 'New',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  declined: 'Declined',
}

function hoursSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
}

export function EnquiryRowLink({ row }: { row: EnquiryRow }) {
  const name = row.customer_first_name ?? 'Customer'
  const sourceLabel = SOURCE_LABEL[row.source]
  const waiting = row.status === 'pending' ? Math.max(0, hoursSince(row.created_at)) : null
  const overdue = waiting !== null && waiting >= 24

  return (
    <Link
      href={`/enquiries/${row.id}`}
      className="group border-border bg-card hover:border-accent/30 flex items-start gap-4 rounded-[--radius-card] border p-4 transition-[border-color] duration-150"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-foreground font-medium">{name}</span>
          {sourceLabel && (
            <span className="text-muted bg-card-subtle rounded-[--radius-tag] px-1.5 py-0.5 text-[11px]">
              {sourceLabel}
            </span>
          )}
        </div>
        <p className="text-body mt-1 line-clamp-2 text-sm">{row.description}</p>
        {row.preferred_date && (
          <p className="text-muted mt-1.5 text-xs">
            Preferred <span className="font-mono">{formatDateShort(row.preferred_date)}</span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Badge status={row.status}>{STATUS_LABEL[row.status]}</Badge>
        {waiting !== null &&
          (overdue ? (
            <Badge variant="pending">{waiting}h waiting</Badge>
          ) : (
            <span className="text-muted text-xs">{waiting}h waiting</span>
          ))}
      </div>
    </Link>
  )
}
