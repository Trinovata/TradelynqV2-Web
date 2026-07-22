import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Enums } from '@/types/database'

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
