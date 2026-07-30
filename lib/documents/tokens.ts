/**
 * Public token document reads + responses (playbook S093, pack
 * api-commerce-public.md §4, spec v2/03 §3.13).
 *
 * The TOKEN is the capability: these pages serve people with no account, so
 * every read runs on the admin client, scoped by the unique token — never a
 * list, never a filter a caller controls. Token shape is validated before any
 * query (qt_tok_/inv_tok_ prefixes from generate_document_token), so garbage
 * never reaches the database, and an unknown token is indistinguishable from
 * an expired one (§14.4: one "This link isn't valid" state).
 *
 * Draft documents do not exist publicly: a draft's token 404s until the
 * document is sent — the professional may still be editing it.
 *
 * Responses are IDEMPOTENT BY READ-BACK: a second accept returns the recorded
 * response rather than an error (double-taps from WhatsApp are normal). The
 * race between two first-taps is settled by a conditional UPDATE on
 * responded_at IS NULL — the loser's write matches zero rows and reads back
 * the winner's response.
 */
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDocumentBranding, type DocumentBranding } from '@/lib/branding/documents'
import type { TierId } from '@/lib/constants/pricing'

const QUOTE_TOKEN_RE = /^qt_tok_[A-Za-z0-9_-]{10,64}$/
const INVOICE_TOKEN_RE = /^inv_tok_[A-Za-z0-9_-]{10,64}$/

export type DocumentLineItem = {
  description: string
  quantity: number
  unit_price: number
  amount: number
}

type ProfessionalIdentity = {
  name: string
  slug: string | null
  avatarUrl: string | null
  whatsapp: string | null
  branding: DocumentBranding
}

export type QuoteDocumentData = {
  id: string
  professional: ProfessionalIdentity
  customerName: string
  lineItems: DocumentLineItem[]
  subtotalTtd: number
  vatPercent: number
  vatAmountTtd: number
  totalTtd: number
  status: string
  validUntil: string | null
  expired: boolean
  notes: string | null
  respondedAt: string | null
  responseNote: string | null
  sentAt: string | null
}

export type InvoiceDocumentData = {
  id: string
  invoiceNumber: string
  professional: ProfessionalIdentity
  customerName: string
  lineItems: DocumentLineItem[]
  subtotalTtd: number
  vatPercent: number
  vatAmountTtd: number
  totalTtd: number
  status: string
  dueDate: string | null
  overdue: boolean
  notes: string | null
  acknowledgedAt: string | null
  sentAt: string | null
}

function parseLineItems(value: unknown): DocumentLineItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    if (typeof row.description !== 'string') return []
    return [
      {
        description: row.description,
        quantity: typeof row.quantity === 'number' ? row.quantity : 1,
        unit_price: typeof row.unit_price === 'number' ? row.unit_price : 0,
        amount: typeof row.amount === 'number' ? row.amount : 0,
      },
    ]
  })
}

/**
 * The professional identity block for a document letterhead. Contact
 * (WhatsApp) is deliberately included: the professional SENT this link to
 * this customer — the document is the post-gate surface, and "Discuss on
 * WhatsApp" is its primary escape hatch.
 */
async function professionalIdentity(professionalId: string): Promise<ProfessionalIdentity | null> {
  const admin = createAdminClient()
  const [{ data: pro }, { data: sub }] = await Promise.all([
    admin
      .from('professional_profiles')
      .select('business_name, slug, profile_photo_url, contact_whatsapp')
      .eq('id', professionalId)
      .maybeSingle(),
    admin
      .from('subscriptions')
      .select('plan_id, subscription_plans(tier)')
      .eq('professional_id', professionalId)
      // The "one live per professional" set (subscriptions_one_live_per_
      // professional_idx) — a past-due professional keeps their branding
      // through the grace ladder rather than snapping to the default.
      .in('status', ['active', 'trialling', 'past_due', 'paused'])
      .maybeSingle(),
  ])
  if (!pro) return null

  const tierRaw = (sub as { subscription_plans?: { tier?: string } | null } | null)
    ?.subscription_plans?.tier
  const tier = (tierRaw ?? null) as TierId | null

  return {
    name: pro.business_name,
    slug: pro.slug,
    avatarUrl: pro.profile_photo_url,
    whatsapp: pro.contact_whatsapp,
    branding: getDocumentBranding(tier),
  }
}

export async function getQuoteByToken(token: string): Promise<QuoteDocumentData | null> {
  if (!QUOTE_TOKEN_RE.test(token)) return null
  const admin = createAdminClient()

  const { data: quote } = await admin
    .from('quotes')
    .select(
      'id, professional_id, customer_name, line_items, subtotal_ttd, vat_percent, vat_amount_ttd, total_ttd, status, valid_until, notes, sent_at, viewed_at, responded_at, response_note'
    )
    .eq('public_token', token)
    .neq('status', 'draft')
    .maybeSingle()
  if (!quote) return null

  const professional = await professionalIdentity(quote.professional_id)
  if (!professional) return null

  // First open stamps viewed (once). Sent → viewed only; never regress a
  // responded status.
  if (!quote.viewed_at) {
    await admin
      .from('quotes')
      .update({
        viewed_at: new Date().toISOString(),
        ...(quote.status === 'sent' ? { status: 'viewed' } : {}),
      })
      .eq('id', quote.id)
      .is('viewed_at', null)
  }

  const expired = Boolean(
    quote.valid_until && new Date(quote.valid_until) < new Date(new Date().toDateString())
  )

  return {
    id: quote.id,
    professional,
    customerName: quote.customer_name,
    lineItems: parseLineItems(quote.line_items),
    subtotalTtd: quote.subtotal_ttd,
    vatPercent: Number(quote.vat_percent),
    vatAmountTtd: quote.vat_amount_ttd,
    totalTtd: quote.total_ttd,
    status: quote.status,
    validUntil: quote.valid_until,
    expired,
    notes: quote.notes,
    respondedAt: quote.responded_at,
    responseNote: quote.response_note,
    sentAt: quote.sent_at,
  }
}

export type QuoteResponseResult =
  | { kind: 'recorded'; status: 'accepted' | 'declined'; respondedAt: string }
  | { kind: 'already'; status: string; respondedAt: string }
  | { kind: 'expired'; expiredAt: string }
  | { kind: 'not_found' }

export async function respondToQuote(
  token: string,
  response: 'accepted' | 'declined',
  note?: string
): Promise<QuoteResponseResult> {
  if (!QUOTE_TOKEN_RE.test(token)) return { kind: 'not_found' }
  const admin = createAdminClient()

  const { data: quote } = await admin
    .from('quotes')
    .select('id, status, valid_until, responded_at')
    .eq('public_token', token)
    .neq('status', 'draft')
    .maybeSingle()
  if (!quote) return { kind: 'not_found' }

  if (quote.responded_at) {
    return { kind: 'already', status: quote.status, respondedAt: quote.responded_at }
  }

  if (quote.valid_until && new Date(quote.valid_until) < new Date(new Date().toDateString())) {
    return { kind: 'expired', expiredAt: quote.valid_until }
  }

  const now = new Date().toISOString()
  // The race between two first-taps: the conditional matches zero rows for
  // the loser, who then reads back the winner's recorded response.
  const { data: updated } = await admin
    .from('quotes')
    .update({ status: response, responded_at: now, response_note: note?.trim() || null })
    .eq('id', quote.id)
    .is('responded_at', null)
    .select('id')
    .maybeSingle()

  if (!updated) {
    const { data: settled } = await admin
      .from('quotes')
      .select('status, responded_at')
      .eq('id', quote.id)
      .maybeSingle()
    return {
      kind: 'already',
      status: settled?.status ?? response,
      respondedAt: settled?.responded_at ?? now,
    }
  }

  return { kind: 'recorded', status: response, respondedAt: now }
}

export async function getInvoiceByToken(token: string): Promise<InvoiceDocumentData | null> {
  if (!INVOICE_TOKEN_RE.test(token)) return null
  const admin = createAdminClient()

  const { data: invoice } = await admin
    .from('invoices')
    .select(
      'id, invoice_number, professional_id, customer_name, line_items, subtotal_ttd, vat_percent, vat_amount_ttd, total_ttd, status, due_date, notes, sent_at, viewed_at, acknowledged_at'
    )
    .eq('public_token', token)
    .neq('status', 'draft')
    .maybeSingle()
  if (!invoice) return null

  const professional = await professionalIdentity(invoice.professional_id)
  if (!professional) return null

  if (!invoice.viewed_at) {
    await admin
      .from('invoices')
      .update({
        viewed_at: new Date().toISOString(),
        ...(invoice.status === 'sent' ? { status: 'viewed' } : {}),
      })
      .eq('id', invoice.id)
      .is('viewed_at', null)
  }

  const overdue =
    invoice.status !== 'paid' &&
    Boolean(invoice.due_date && new Date(invoice.due_date) < new Date(new Date().toDateString()))

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    professional,
    customerName: invoice.customer_name,
    lineItems: parseLineItems(invoice.line_items),
    subtotalTtd: invoice.subtotal_ttd,
    vatPercent: Number(invoice.vat_percent),
    vatAmountTtd: invoice.vat_amount_ttd,
    totalTtd: invoice.total_ttd,
    status: invoice.status,
    dueDate: invoice.due_date,
    overdue,
    notes: invoice.notes,
    acknowledgedAt: invoice.acknowledged_at,
    sentAt: invoice.sent_at,
  }
}

export type AcknowledgeResult =
  | { kind: 'recorded'; acknowledgedAt: string }
  | { kind: 'already'; acknowledgedAt: string }
  | { kind: 'not_found' }

export async function acknowledgeInvoice(token: string): Promise<AcknowledgeResult> {
  if (!INVOICE_TOKEN_RE.test(token)) return { kind: 'not_found' }
  const admin = createAdminClient()

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, acknowledged_at')
    .eq('public_token', token)
    .neq('status', 'draft')
    .maybeSingle()
  if (!invoice) return { kind: 'not_found' }

  if (invoice.acknowledged_at) {
    return { kind: 'already', acknowledgedAt: invoice.acknowledged_at }
  }

  const now = new Date().toISOString()
  const { data: updated } = await admin
    .from('invoices')
    .update({ acknowledged_at: now })
    .eq('id', invoice.id)
    .is('acknowledged_at', null)
    .select('id')
    .maybeSingle()

  if (!updated) {
    const { data: settled } = await admin
      .from('invoices')
      .select('acknowledged_at')
      .eq('id', invoice.id)
      .maybeSingle()
    return { kind: 'already', acknowledgedAt: settled?.acknowledged_at ?? now }
  }

  return { kind: 'recorded', acknowledgedAt: now }
}
