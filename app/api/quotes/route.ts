/**
 * POST /api/quotes (playbook S109, pack api-operations.md §3.1).
 *
 * A professional drafts a quote. Open to BOTH professional subtypes — the V2
 * consolidation fix for the pack's flagged "quotes are business-only" gap
 * (§Flags): requireProfessional covers sole traders and registered businesses
 * alike. Totals are SERVER-RECOMPUTED from the line items via
 * computeQuoteTotals — the client's subtotal/total are never trusted (§3.1
 * flag). The DB CHECK (total = subtotal + vat) is the backstop.
 *
 * Route order: rate-limit → auth(professional) → zod → RLS insert
 * (owns_professional_profile enforces the professional_id at the DB). The
 * public_token generates by column default, so a draft is immediately
 * sendable but not yet public (the /q page 404s a draft until /send).
 */
import { requireProfessional } from '@/lib/access/api'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import { quoteDraftSchema, computeQuoteTotals } from '@/lib/quotes'

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
  const parsed = quoteDraftSchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return err('INVALID_INPUT', { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors })
  }
  const body = parsed.data

  const totals = computeQuoteTotals(body.line_items, body.vat_percent)

  const { data: created, error } = await access.supabase
    .from('quotes')
    .insert({
      professional_id: access.professionalId,
      customer_name: body.customer_name,
      customer_email: body.customer_email || null,
      customer_phone: body.customer_phone || null,
      line_items: totals.lineItems,
      subtotal_ttd: totals.subtotalTtd,
      vat_percent: totals.vatPercent,
      vat_amount_ttd: totals.vatAmountTtd,
      total_ttd: totals.totalTtd,
      valid_until: body.valid_until || null,
      notes: body.notes || null,
      status: 'draft',
    })
    .select('id, public_token, status, total_ttd')
    .single()

  if (error || !created) {
    logger.error('quote:create_failed', { code: error?.code })
    return err('INTERNAL')
  }

  return ok({
    quote: {
      id: created.id,
      status: created.status,
      public_token: created.public_token,
      total_ttd: created.total_ttd,
    },
  })
}
