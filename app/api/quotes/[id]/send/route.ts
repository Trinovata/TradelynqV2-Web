/**
 * POST /api/quotes/[id]/send (playbook S109, pack §3.2).
 *
 * Marks a draft quote sent and returns the customer link
 * (https://<site>/q/<public_token>). Only a DRAFT of the caller's own is
 * sendable — the RLS UPDATE (owns_professional_profile) scopes ownership, and
 * the `.eq('status','draft')` makes the transition atomic: a double-send or a
 * send of an already-responded quote matches zero rows → 409, never a
 * re-notify. Sent quotes are immutable (revising = duplicate-as-draft, §3.2) —
 * enforced by there being no edit path once status leaves draft.
 *
 * The email + WhatsApp share are the notify dispatcher's job (S135); the link
 * is returned so the workspace can offer the WhatsApp share immediately.
 */
import { requireProfessional } from '@/lib/access/api'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tradelynq.tech'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const limit = await checkRateLimit('api', identifierFrom(request))
  if (!limit.ok) return limit.response

  const access = await requireProfessional(request)
  if (!access.ok) return access.response

  const { id } = await ctx.params

  const { data: sent, error } = await access.supabase
    .from('quotes')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')
    .select('id, public_token')
    .maybeSingle()

  if (error) {
    logger.error('quote:send_failed', { quoteId: id, code: error.code })
    return err('INTERNAL')
  }
  if (!sent) {
    // Not the caller's, not found, or no longer a draft — indistinguishable,
    // all "cannot send this now".
    return err('CONFLICT_STATE', {
      resource: 'quote',
      currentState: 'not_draft',
      attemptedTransition: 'send',
    })
  }

  // TODO(S135): fire the customer email + WhatsApp share through the dispatcher.
  logger.info('quote:sent', { quoteId: sent.id })

  return ok({
    quote: {
      id: sent.id,
      status: 'sent',
      customer_link: `${SITE_URL}/q/${sent.public_token}`,
    },
  })
}
