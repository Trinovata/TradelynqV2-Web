/**
 * POST /api/professional/webhooks/[id]/test (playbook S116).
 *
 * Sends a `ping` to the endpoint and returns whether it answered, so the owner
 * can confirm their n8n workflow (or any consumer) is wired up before relying on
 * real events. Ownership is proven on the RLS client first; delivery then runs
 * through the shared dispatcher so a test behaves exactly like a real delivery —
 * same signing, same log, same health accounting.
 *
 * Route order: rate-limit -> auth -> tier -> ownership -> deliver.
 */
import { requireProfessional, requireTierFeature } from '@/lib/access/api'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import { sendTestPing } from '@/lib/webhooks/dispatch'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const limit = await checkRateLimit('api', identifierFrom(request))
  if (!limit.ok) return limit.response

  const access = await requireProfessional(request)
  if (!access.ok) return access.response

  const gate = requireTierFeature(access, 'webhooks')
  if (!gate.ok) return gate.response

  const { id } = await ctx.params

  // Prove ownership on the RLS client before the dispatcher (which runs as
  // service role) touches this endpoint.
  const { data: owned, error } = await access.supabase
    .from('webhook_configs')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    logger.error('webhook:test_ownership_check_failed', { id, code: error.code })
    return err('INTERNAL')
  }
  if (!owned) return err('NOT_FOUND', { resource: 'webhook' })

  const result = await sendTestPing(id, access.professionalId)
  return ok({ test: result })
}
