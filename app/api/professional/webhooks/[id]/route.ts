/**
 * A single webhook endpoint (playbook S116).
 *
 *   PATCH  /api/professional/webhooks/[id] — edit url/events, pause, or reactivate
 *   DELETE /api/professional/webhooks/[id] — remove it (and cascade its log)
 *
 * Enterprise-gated; ownership is enforced by the `webhook_configs_own` RLS policy,
 * so a mismatched id simply matches zero rows and returns NOT_FOUND.
 *
 * Reactivation is the one operation that cannot go through the caller's own
 * client: clearing an auto-disable also has to reset the failure streak, and the
 * `guard_webhook_privileged_columns` trigger forbids the owner from touching that
 * counter. So a reactivation is performed with the service-role client AFTER the
 * RLS client has proven ownership — never as a way around the guard, only to do
 * the one thing the guard exists to keep out of the owner's hands.
 */
import { z } from 'zod'
import { requireProfessional, requireTierFeature } from '@/lib/access/api'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { EVENT_TYPES } from '@/lib/events/catalog'

const LIST_COLUMNS =
  'id, url, events, is_active, consecutive_failures, disabled_at, disabled_reason, last_success_at, created_at'

const patchSchema = z
  .object({
    url: z
      .string()
      .trim()
      .url()
      .refine((u) => u.startsWith('https://'), { message: 'Endpoint URL must use HTTPS.' })
      .optional(),
    events: z
      .array(z.enum(EVENT_TYPES))
      .min(1, 'Subscribe to at least one event.')
      .transform((list) => [...new Set(list)])
      .optional(),
    /** Pause (`false`) or resume/reactivate (`true`). */
    is_active: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update.' })

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const limit = await checkRateLimit('api', identifierFrom(request))
  if (!limit.ok) return limit.response

  const access = await requireProfessional(request)
  if (!access.ok) return access.response

  const gate = requireTierFeature(access, 'webhooks')
  if (!gate.ok) return gate.response

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return err('INVALID_INPUT', { fieldErrors: {}, formErrors: ['Send a JSON body.'] })
  }
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return err('INVALID_INPUT', { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors })
  }

  const { id } = await ctx.params

  // Read current state (RLS-scoped: also proves ownership before any admin write).
  const { data: current, error: readError } = await access.supabase
    .from('webhook_configs')
    .select('id, disabled_at')
    .eq('id', id)
    .maybeSingle()

  if (readError) {
    logger.error('webhook:read_failed', { id, code: readError.code })
    return err('INTERNAL')
  }
  if (!current) return err('NOT_FOUND', { resource: 'webhook' })

  const reactivating = parsed.data.is_active === true && current.disabled_at !== null

  if (reactivating) {
    // Ownership already proven above. The service-role client can clear the
    // auto-disable AND reset the streak in one write, which the owner's client
    // cannot (the guard blocks the counter). Any concurrent edits to url/events
    // in the same request ride along here.
    const update: Record<string, unknown> = {
      is_active: true,
      disabled_at: null,
      disabled_reason: null,
      consecutive_failures: 0,
    }
    if (parsed.data.url !== undefined) update.url = parsed.data.url
    if (parsed.data.events !== undefined) update.events = parsed.data.events

    const { data, error } = await createAdminClient()
      .from('webhook_configs')
      .update(update as never)
      .eq('id', id)
      .eq('professional_id', access.professionalId)
      .select(LIST_COLUMNS)
      .single()

    if (error) {
      logger.error('webhook:reactivate_failed', { id, code: error.code })
      return err('INTERNAL')
    }
    return ok({ webhook: data })
  }

  // A plain edit — safe on the owner's RLS client (the guard only bites the
  // privileged stat columns, none of which are set here).
  const update: Record<string, unknown> = {}
  if (parsed.data.url !== undefined) update.url = parsed.data.url
  if (parsed.data.events !== undefined) update.events = parsed.data.events
  if (parsed.data.is_active !== undefined) update.is_active = parsed.data.is_active

  const { data, error } = await access.supabase
    .from('webhook_configs')
    .update(update as never)
    .eq('id', id)
    .select(LIST_COLUMNS)
    .maybeSingle()

  if (error) {
    logger.error('webhook:update_failed', { id, code: error.code })
    return err('INTERNAL')
  }
  if (!data) return err('NOT_FOUND', { resource: 'webhook' })

  return ok({ webhook: data })
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const limit = await checkRateLimit('api', identifierFrom(request))
  if (!limit.ok) return limit.response

  const access = await requireProfessional(request)
  if (!access.ok) return access.response

  const gate = requireTierFeature(access, 'webhooks')
  if (!gate.ok) return gate.response

  const { id } = await ctx.params

  const { data, error } = await access.supabase
    .from('webhook_configs')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    logger.error('webhook:delete_failed', { id, code: error.code })
    return err('INTERNAL')
  }
  if (!data) return err('NOT_FOUND', { resource: 'webhook' })

  return ok({ deleted: id })
}
