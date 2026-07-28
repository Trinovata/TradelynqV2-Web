/**
 * POST /api/invoices (playbook S111, pack api-operations.md §2).
 *
 * A professional issues an invoice. Same money discipline as quotes: totals
 * are SERVER-RECOMPUTED (computeQuoteTotals — line-item maths is identical),
 * never trusted from the client. invoice_number is DATABASE-assigned by the
 * assign_invoice_number trigger, so the caller cannot choose or collide one.
 * Open to both professional subtypes via requireProfessional.
 *
 * FLAG (spec section 5.6): the monthly issue cap (27/30 amber, 403 at 31) is a
 * TIER feature — the cap rises with the plan — so it needs the subscription
 * model that lands with S115. A flat cap now would fabricate the
 * currentTier/requiredTier the TIER_UPGRADE_REQUIRED contract requires;
 * deferred with the tier surface (the UI cap meter lands there too).
 *
 * Route order: rate-limit -> auth -> zod -> RLS insert.
 */
import { z } from 'zod'
import { requireProfessional } from '@/lib/access/api'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import { emitEvent } from '@/lib/events/emit'
import { lineItemSchema, computeQuoteTotals } from '@/lib/quotes'

const bodySchema = z.object({
  customer_name: z.string().trim().min(1).max(200),
  customer_email: z.string().trim().email().max(320).optional().or(z.literal('')),
  customer_phone: z.string().trim().max(40).optional().or(z.literal('')),
  line_items: z.array(lineItemSchema).min(1).max(50),
  vat_percent: z.number().min(0).max(100).default(0),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
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

  const totals = computeQuoteTotals(body.line_items, body.vat_percent)

  // invoice_number is omitted deliberately: the assign_invoice_number BEFORE
  // INSERT trigger sets it (NOT NULL in the type since it has no column
  // default). The generated Insert type still lists it as required, so the
  // payload is cast — the DB, not this route, is the authority on the number.
  const insertPayload = {
    professional_id: access.professionalId,
    customer_name: body.customer_name,
    customer_email: body.customer_email || null,
    customer_phone: body.customer_phone || null,
    line_items: totals.lineItems,
    subtotal_ttd: totals.subtotalTtd,
    vat_percent: totals.vatPercent,
    vat_amount_ttd: totals.vatAmountTtd,
    total_ttd: totals.totalTtd,
    due_date: body.due_date || null,
    notes: body.notes || null,
    status: 'draft' as const,
  }

  const { data: created, error } = await access.supabase
    .from('invoices')
    .insert(insertPayload as never)
    .select('id, invoice_number, public_token, total_ttd, created_at')
    .single()

  if (error || !created) {
    logger.error('invoice:create_failed', { code: error?.code })
    return err('INTERNAL')
  }

  emitEvent(access.professionalId, {
    type: 'invoice.created',
    data: {
      invoice_id: created.id,
      invoice_number: created.invoice_number,
      customer_name: body.customer_name,
      amount_ttd: created.total_ttd,
      currency: 'TTD',
      due_date: body.due_date || null,
      created_at: created.created_at,
    },
  })

  return ok({
    invoice: {
      id: created.id,
      invoice_number: created.invoice_number,
      public_token: created.public_token,
      total_ttd: created.total_ttd,
      status: 'draft',
    },
  })
}
