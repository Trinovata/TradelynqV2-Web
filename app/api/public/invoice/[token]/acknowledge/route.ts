/**
 * POST /api/public/invoice/[token]/acknowledge (playbook S093, pack §4.2).
 * Idempotent receipt record — a second tap returns the recorded timestamp.
 */
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { acknowledgeInvoice } from '@/lib/documents/tokens'

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const limit = await checkRateLimit('api', identifierFrom(request))
  if (!limit.ok) return limit.response

  const { token } = await ctx.params
  const result = await acknowledgeInvoice(token)

  if (result.kind === 'not_found') return err('NOT_FOUND', { resource: 'invoice' })
  return ok({ acknowledged: true, acknowledged_at: result.acknowledgedAt })
}
