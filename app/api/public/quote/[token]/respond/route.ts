/**
 * POST /api/public/quote/[token]/respond (playbook S093, pack §4.1).
 *
 * Unauthenticated by design — the token is the capability, and the customer
 * may have no account. Idempotent: a second submit returns 200 with the
 * recorded response (double-taps from WhatsApp are normal); expired validity
 * is 409 CONFLICT_STATE; an unknown token is 404, indistinguishable from a
 * revoked one. Token routes are the platform's most exposed surface — the
 * shape check in lib/documents/tokens.ts rejects garbage before any query,
 * and the api limiter bounds enumeration.
 */
import { z } from 'zod'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { respondToQuote } from '@/lib/documents/tokens'

const bodySchema = z.object({
  response: z.enum(['accepted', 'declined']),
  note: z.string().trim().max(1000).optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const limit = await checkRateLimit('api', identifierFrom(request))
  if (!limit.ok) return limit.response

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

  const { token } = await ctx.params
  const result = await respondToQuote(token, parsed.data.response, parsed.data.note)

  switch (result.kind) {
    case 'not_found':
      return err('NOT_FOUND', { resource: 'quote' })
    case 'expired':
      return err('CONFLICT_STATE', {
        resource: 'quote',
        currentState: 'expired',
        attemptedTransition: parsed.data.response,
      })
    case 'already':
      // Idempotent success — the recorded response, never an error.
      return ok({ success: true, status: result.status, responded_at: result.respondedAt })
    case 'recorded':
      return ok({ success: true, status: result.status, responded_at: result.respondedAt })
  }
}
