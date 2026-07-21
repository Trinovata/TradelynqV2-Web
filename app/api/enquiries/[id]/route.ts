/**
 * PATCH /api/enquiries/[id] (playbook S108, spec 05 §5.2–5.3)
 *
 * The professional acts on one enquiry: accept, decline (with a reason), start,
 * or complete. Each action is a guarded status transition — the server owns the
 * state machine, so an out-of-order move (completing something never accepted)
 * is a 409, not a silent write.
 *
 * Route order: auth (professional, either transport) → zod → RLS write. No
 * rate-limit: the write is a single owned row and idempotent per target state.
 * The database's column guard (`guard_job_enquiry_columns`) is the real
 * boundary — this route enforces the *transitions*; the trigger enforces that a
 * professional may only ever touch outcome columns. Both must hold.
 *
 * Notifying the customer is deferred to the Phase-8 notify dispatcher; the
 * side-effect point is marked rather than faked with a direct send.
 */
import { z } from 'zod'
import { requireProfessional } from '@/lib/access/api'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import type { Database, Enums } from '@/types/database'

type Status = Enums<'enquiry_status'>
type EnquiryUpdate = Database['public']['Tables']['job_enquiries']['Update']

const ACTIONS = ['accept', 'decline', 'start', 'complete'] as const
type Action = (typeof ACTIONS)[number]

/** The state machine, in one place. `from` are the states an action may leave. */
const TRANSITIONS: Record<
  Action,
  { from: readonly Status[]; to: Status; stamp?: 'accepted_at' | 'completed_at'; needsReason?: boolean }
> = {
  accept: { from: ['pending'], to: 'accepted', stamp: 'accepted_at' },
  decline: { from: ['pending'], to: 'declined', needsReason: true },
  start: { from: ['accepted'], to: 'in_progress' },
  complete: { from: ['accepted', 'in_progress'], to: 'completed', stamp: 'completed_at' },
}

const bodySchema = z.object({
  action: z.enum(ACTIONS),
  // Only decline uses it; capped to match the deck's free-text limit (§5.3).
  reason: z.string().trim().min(1).max(500).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireProfessional(request)
  if (!ctx.ok) return ctx.response

  const { id } = await params

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return err('INVALID_INPUT', { fieldErrors: {}, formErrors: ['Send a JSON body.'] })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return err('INVALID_INPUT', { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors })
  }

  const { action } = parsed.data
  const move = TRANSITIONS[action]

  if (move.needsReason && !parsed.data.reason) {
    return err('INVALID_INPUT', {
      fieldErrors: { reason: ['Choose a reason for declining.'] },
      formErrors: [],
    })
  }

  // Read the current state through the RLS client — this both fetches the status
  // and proves ownership (the select returns nothing for someone else's enquiry).
  const { data: current, error: readError } = await ctx.supabase
    .from('job_enquiries')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  if (readError) {
    logger.error('enquiry:read_failed', { enquiryId: id, code: readError.code })
    return err('INTERNAL')
  }
  if (!current) return err('NOT_FOUND', { resource: 'enquiry' })

  if (!move.from.includes(current.status)) {
    return err('CONFLICT_STATE', {
      resource: 'enquiry',
      currentState: current.status,
      attemptedTransition: action,
    })
  }

  const patch: EnquiryUpdate = { status: move.to }
  if (move.stamp) patch[move.stamp] = new Date().toISOString()
  if (action === 'decline') patch.declined_reason = parsed.data.reason ?? null

  const { data: updated, error: writeError } = await ctx.supabase
    .from('job_enquiries')
    .update(patch)
    .eq('id', id)
    .select('id, status, accepted_at, completed_at, declined_reason')
    .maybeSingle()

  if (writeError) {
    logger.error('enquiry:update_failed', { enquiryId: id, action, code: writeError.code })
    return err('INTERNAL')
  }
  if (!updated) return err('NOT_FOUND', { resource: 'enquiry' })

  // TODO(S135): notify the customer through the notify dispatcher — enquiry
  // accepted / declined (with the polite suggest-others message) / completed.
  logger.info('enquiry:transition', { enquiryId: id, action, to: move.to })

  return ok({ enquiry: updated })
}
