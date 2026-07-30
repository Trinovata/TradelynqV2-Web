/**
 * POST /api/jobs (playbook S110, pack api-operations.md §1).
 *
 * A professional logs a job — work they're doing off-platform (a WhatsApp
 * lead, a walk-in). The DB FORCES every new job to `enquiry` with no stamps
 * (guard_job_insert — a professional can't self-create an advanced job and
 * fake completion metrics). So a logged job is WALKED forward through the
 * state machine (enquiry -> accepted -> in_progress) via the same guarded
 * UPDATE path the pipeline uses; the enforce_job_status_transition trigger
 * validates each step and sets the stamps. It lands in_progress, which is
 * what "I'm doing this job" means.
 *
 * Route order: rate-limit -> auth(professional) -> zod -> RLS insert -> walk.
 */
import { z } from 'zod'
import { requireProfessional } from '@/lib/access/api'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'

const bodySchema = z.object({
  customer_name: z.string().trim().min(1).max(200),
  customer_phone: z.string().trim().max(40).optional().or(z.literal('')),
  service_description: z.string().trim().min(1).max(1000),
  job_value_ttd: z.number().int().min(0).max(100_000_000).optional(),
})

export async function POST(request: Request) {
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
  const body = parsed.data

  // 1. Insert — forced to 'enquiry' by guard_job_insert regardless of what we
  //    send, so status/stamps are omitted. Only the professional's own data.
  const { data: created, error } = await access.supabase
    .from('jobs')
    .insert({
      professional_id: access.professionalId,
      // 'other' is the job_source for a hand-logged job (no 'manual' member).
      source: 'other',
      customer_name: body.customer_name,
      customer_phone: body.customer_phone || null,
      service_description: body.service_description,
      job_value_ttd: typeof body.job_value_ttd === 'number' ? body.job_value_ttd : null,
    })
    .select('id')
    .single()

  if (error || !created) {
    logger.error('job:create_failed', { code: error?.code })
    return err('INTERNAL')
  }

  // 2. Walk it to in_progress through the guarded transitions. The trigger
  //    validates each hop and stamps accepted_at / in_progress_at itself. If a
  //    hop fails the job simply stays where it got to — never an error the user
  //    can't act on (they can advance it from the pipeline).
  for (const next of ['accepted', 'in_progress'] as const) {
    const { error: stepError } = await access.supabase
      .from('jobs')
      .update({ status: next })
      .eq('id', created.id)
    if (stepError) {
      logger.error('job:walk_failed', { jobId: created.id, next, code: stepError.code })
      break
    }
  }

  return ok({ job: { id: created.id, status: 'in_progress' } })
}
