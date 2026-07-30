/**
 * POST /api/invoices/[id]/send (playbook S111, pack section 2).
 *
 * Marks a draft invoice sent and returns the customer link
 * (https://<site>/i/<public_token>). Atomic draft->sent transition scoped by
 * RLS (owns_professional_profile): a double-send or send-of-non-draft matches
 * zero rows -> 409. The customer acknowledges on the /i/[token] page (S093).
 * Email + PDF delivery is the notify dispatcher's job (S135); the link is
 * returned so the workspace offers the WhatsApp share immediately.
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
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')
    .select('id, public_token, invoice_number')
    .maybeSingle()

  if (error) {
    logger.error('invoice:send_failed', { invoiceId: id, code: error.code })
    return err('INTERNAL')
  }
  if (!sent) {
    return err('CONFLICT_STATE', {
      resource: 'invoice',
      currentState: 'not_draft',
      attemptedTransition: 'send',
    })
  }

  // TODO(S135): fire customer email + PDF + WhatsApp share through the dispatcher.
  logger.info('invoice:sent', { invoiceId: sent.id })

  return ok({
    invoice: {
      id: sent.id,
      invoice_number: sent.invoice_number,
      status: 'sent',
      customer_link: `${SITE_URL}/i/${sent.public_token}`,
    },
  })
}
