/**
 * PATCH /api/jobs/[id] (playbook S110, pack §1). The professional advances a
 * job through its pipeline. The enforce_job_status_transition trigger is the
 * real authority — it validates the hop against the allowed graph
 * (accepted->in_progress->completed<->in_progress) AND sets every lifecycle
 * stamp itself, so this route sends ONLY the target status. The `.eq('status',
 * from)` guard makes each transition atomic — a stale-tab move matches zero
 * rows -> 409 rather than fighting the trigger.
 */
import { z } from 'zod'
import { requireProfessional } from '@/lib/access/api'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import type { Enums } from '@/types/database'

type Status = Enums<'job_status'>

const ACTIONS = ['start', 'complete', 'reopen'] as const
type Action = (typeof ACTIONS)[number]

/** from-state(s) -> to-state, matching the DB's allowed graph exactly. Stamps
 *  are the trigger's job, never this route's. */
const TRANSITIONS: Record<Action, { from: Status[]; to: Status }> = {
  start: { from: ['accepted'], to: 'in_progress' },
  complete: { from: ['in_progress'], to: 'completed' },
  reopen: { from: ['completed'], to: 'in_progress' },
}

const bodySchema = z.object({ action: z.enum(ACTIONS) })

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireProfessional(request)
  if (!access.ok) return access.response

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

  const { id } = await ctx.params
  const t = TRANSITIONS[parsed.data.action]

  const { data, error } = await access.supabase
    .from('jobs')
    .update({ status: t.to })
    .eq('id', id)
    .in('status', t.from)
    .select('id, status')
    .maybeSingle()

  if (error) {
    logger.error('job:transition_failed', { jobId: id, code: error.code })
    return err('INTERNAL')
  }
  if (!data) {
    return err('CONFLICT_STATE', {
      resource: 'job',
      currentState: 'unexpected',
      attemptedTransition: parsed.data.action,
    })
  }

  return ok({ job: { id: data.id, status: data.status } })
}
