import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Enums } from '@/types/database'
import type { TimelineEvent } from '@/components/shared/Timeline'

/**
 * Enquiries data access (playbook S105, spec 05 §5).
 *
 * One read primitive backs the whole surface: `professional_enquiry_inbox`, a
 * SECURITY DEFINER function that returns the calling professional's enquiries
 * with the customer's first name attached (the one field RLS would otherwise
 * hide — see the migration for why). Everything the list and the read-only
 * detail render comes from this single call.
 */

/**
 * A row as the UI actually needs it. The generated `Returns` type marks every
 * column non-null because Postgres cannot express per-column nullability through
 * `RETURNS TABLE`; this type restores the truth so the UI handles the nulls it
 * will really see (an unnamed customer, an enquiry with no agreed price yet).
 */
export type EnquiryRow = {
  id: string
  status: Enums<'enquiry_status'>
  source: Enums<'job_source'>
  description: string
  preferred_date: string | null
  contact_preference: Enums<'contact_preference'>
  created_at: string
  accepted_at: string | null
  completed_at: string | null
  category_id: string | null
  agreed_price_ttd: number | null
  agreed_timeline: string | null
  scope_note: string | null
  professional_notes: string | null
  declined_reason: string | null
  customer_first_name: string | null
}

/** The three list tabs (spec 05 §5.1), and which statuses fall under each. */
export type EnquiryTab = 'new' | 'active' | 'done'

export const TAB_STATUSES: Record<EnquiryTab, ReadonlyArray<Enums<'enquiry_status'>>> = {
  new: ['pending'],
  active: ['accepted', 'in_progress'],
  done: ['completed', 'cancelled', 'declined'],
}

export function tabForStatus(status: Enums<'enquiry_status'>): EnquiryTab {
  if (TAB_STATUSES.new.includes(status)) return 'new'
  if (TAB_STATUSES.active.includes(status)) return 'active'
  return 'done'
}

/**
 * The calling professional's full inbox, newest first. One call returns every
 * tab's worth; the page filters in memory, so switching tabs never re-fetches.
 *
 * `rows` is always an array (empty on failure) and `error` is independent, so
 * callers guard on `error` without having to null-check `rows` afterwards.
 */
export async function getEnquiryInbox(
  supabase: SupabaseClient<Database>
): Promise<{ rows: EnquiryRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('professional_enquiry_inbox')

  if (error) {
    return { rows: [], error: error.message }
  }

  return { rows: (data ?? []) as EnquiryRow[], error: null }
}

/** A customer's own enquiry, as their portal shows it — with the professional's
 *  public name and slug so they can see who they reached and follow the reply. */
export type CustomerEnquiryRow = {
  id: string
  status: Enums<'enquiry_status'>
  description: string
  preferred_date: string | null
  created_at: string
  declined_reason: string | null
  professional: { business_name: string; slug: string | null } | null
}

export type CustomerEnquiryDetail = {
  id: string
  status: Enums<'enquiry_status'>
  description: string
  preferred_date: string | null
  created_at: string
  accepted_at: string | null
  completed_at: string | null
  declined_reason: string | null
  contact_preference: Enums<'contact_preference'>
  /** Public identity only — professional_notes and agreed_* are NOT selected. */
  professional: {
    id: string
    business_name: string
    slug: string | null
    contact_whatsapp: string | null
  } | null
  /** Whether this customer has already left a review for this enquiry. */
  hasReview: boolean
}

/**
 * One enquiry the calling customer owns, or null. RLS scopes the row to
 * `customer_id = auth.uid()`; the professional-private columns
 * (professional_notes, agreed_price_ttd, scope_note, …) are deliberately NOT
 * in the select list — RLS cannot hide a column from a row the customer may
 * read, so redaction is the column list, exactly as the migration header warns.
 * Contact WhatsApp comes via the admin client only once accepted (the reveal
 * a connection already granted).
 */
export async function getCustomerEnquiryDetail(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<CustomerEnquiryDetail | null> {
  const { data, error } = await supabase
    .from('job_enquiries')
    .select(
      'id, status, description, preferred_date, created_at, accepted_at, completed_at, declined_reason, contact_preference, professional_id, professional_profiles(id, business_name, slug)'
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null

  const pro = data.professional_profiles as {
    id: string
    business_name: string
    slug: string | null
  } | null

  // The professional's WhatsApp is a post-reveal field; a customer with an
  // accepted enquiry has a connection, so read it through the admin client
  // (the RLS client cannot select the gated column since 20260724000001).
  let whatsapp: string | null = null
  if (pro && (data.status === 'accepted' || data.status === 'in_progress')) {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data: contact } = await createAdminClient()
      .from('professional_profiles')
      .select('contact_whatsapp')
      .eq('id', pro.id)
      .maybeSingle()
    whatsapp = contact?.contact_whatsapp ?? null
  }

  const { count } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('job_enquiry_id', id)

  return {
    id: data.id,
    status: data.status,
    description: data.description,
    preferred_date: data.preferred_date,
    created_at: data.created_at,
    accepted_at: data.accepted_at,
    completed_at: data.completed_at,
    declined_reason: data.declined_reason,
    contact_preference: data.contact_preference,
    professional: pro
      ? {
          id: pro.id,
          business_name: pro.business_name,
          slug: pro.slug,
          contact_whatsapp: whatsapp,
        }
      : null,
    hasReview: (count ?? 0) > 0,
  }
}

/**
 * The status timeline events for an enquiry (spec §4.2): submitted →
 * accepted/declined → in progress → completed, each stamped. Derived from the
 * lifecycle columns rather than an event log — the stamps ARE the history.
 *
 * The `status` field is a canonical `StatusKey` (Badge.tsx) — the Timeline
 * maps it to the dot colour centrally, so a "done" step reads green and the
 * live step reads accent everywhere the same way.
 */
export function enquiryTimeline(detail: CustomerEnquiryDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: 'submitted',
      kind: 'status_change',
      label: 'Enquiry sent',
      timestamp: detail.created_at,
      status: 'completed',
    },
  ]

  if (detail.status === 'declined') {
    events.push({
      id: 'declined',
      kind: 'status_change',
      label: 'Declined',
      detail: detail.declined_reason ?? undefined,
      timestamp: detail.created_at,
      status: 'declined',
    })
    return events
  }

  if (detail.accepted_at) {
    events.push({
      id: 'accepted',
      kind: 'status_change',
      label: 'Accepted',
      timestamp: detail.accepted_at,
      // The live step reads accent; a superseded one reads done.
      status: detail.status === 'accepted' ? 'accepted' : 'completed',
    })
  }
  if (detail.status === 'in_progress') {
    events.push({
      id: 'in_progress',
      kind: 'status_change',
      label: 'In progress',
      timestamp: detail.accepted_at ?? detail.created_at,
      status: 'in_progress',
    })
  }
  if (detail.completed_at) {
    events.push({
      id: 'completed',
      kind: 'status_change',
      label: 'Completed',
      timestamp: detail.completed_at,
      status: 'completed',
    })
  }
  return events
}

/**
 * The calling customer's own enquiries, newest first. Straightforward RLS read —
 * `job_enquiries` lets a customer see rows where `customer_id = auth.uid()`, and
 * the professional's public name/slug embed (visible for active listings) tells
 * them who they reached.
 */
export async function getCustomerEnquiries(
  supabase: SupabaseClient<Database>
): Promise<{ rows: CustomerEnquiryRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('job_enquiries')
    .select(
      'id, status, description, preferred_date, created_at, declined_reason, professional_profiles(business_name, slug)'
    )
    .order('created_at', { ascending: false })

  if (error) return { rows: [], error: error.message }

  const rows = (data ?? []).map((r) => {
    const pro = r.professional_profiles as { business_name: string; slug: string | null } | null
    return {
      id: r.id,
      status: r.status,
      description: r.description,
      preferred_date: r.preferred_date,
      created_at: r.created_at,
      declined_reason: r.declined_reason,
      professional: pro,
    }
  })
  return { rows, error: null }
}
