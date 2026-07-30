/**
 * POST /api/enquiries/[id]/cancel (playbook S098, spec 04 §4.2).
 *
 * The customer's one action on their own enquiry: cancel it while it is still
 * pending. Separate from the professional's PATCH state machine — a customer
 * may only ever cancel, and only from `pending` (once a professional has
 * accepted, the work is a conversation, not a request to withdraw). The RLS
 * client scopes the write to the caller's own row; the `.eq('status',
 * 'pending')` makes the guard atomic, so a race against a professional's
 * accept resolves to "zero rows updated" → 409, never a double-write.
 *
 * Route order: auth (customer) → RLS write. No body, no rate-limit — a single
 * owned row, idempotent per target state.
 */
import { requireCustomer } from '@/lib/access/api'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireCustomer()
  if (!access.ok) return access.response

  const { id } = await ctx.params

  const { data, error } = await access.supabase
    .from('job_enquiries')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('customer_id', access.userId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) {
    logger.error('enquiry:cancel_failed', { enquiryId: id, code: error.code })
    return err('INTERNAL')
  }

  if (!data) {
    // Either not the caller's row, or no longer pending — indistinguishable to
    // the customer, and both mean "you cannot cancel this now".
    return err('CONFLICT_STATE', {
      resource: 'enquiry',
      currentState: 'not_pending',
      attemptedTransition: 'cancel',
    })
  }

  return ok({ success: true, status: 'cancelled' })
}
