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
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import { emitEvent } from '@/lib/events/emit'
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
  // Rate-limit first (route-order law): this route emits webhook events, so an
  // unthrottled complete/reopen loop would be a dispatch trigger.
  const limit = await checkRateLimit('api', identifierFrom(request))
  if (!limit.ok) return limit.response

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
    .select('id, status, customer_name, service_description, in_progress_at, completed_at')
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

  // The transition is committed; announce it (best-effort, post-response — see
  // emitEvent). Reopen carries no event: it is a correction, not a milestone a
  // downstream workflow should act on.
  if (parsed.data.action === 'start') {
    emitEvent(access.professionalId, {
      type: 'job.started',
      data: {
        job_id: data.id,
        customer_name: data.customer_name,
        title: data.service_description,
        started_at: data.in_progress_at ?? new Date().toISOString(),
      },
    })
  } else if (parsed.data.action === 'complete') {
    emitEvent(access.professionalId, {
      type: 'job.completed',
      data: {
        job_id: data.id,
        customer_name: data.customer_name,
        title: data.service_description,
        completed_at: data.completed_at ?? new Date().toISOString(),
      },
    })
  }

  return ok({ job: { id: data.id, status: data.status } })
}
