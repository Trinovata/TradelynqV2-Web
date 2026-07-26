/**
 * Professional quote reads (playbook S109). RLS-scoped: quotes_select_own
 * (owns_professional_profile) returns only the caller's rows, so these never
 * leak another professional's pipeline. Never cached — a quote's status is
 * money-adjacent and must reflect the customer's latest response.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Enums } from '@/types/database'
import type { QuoteLineItem } from '@/lib/quotes'

export type QuoteListRow = {
  id: string
  customerName: string
  status: Enums<'quote_status'>
  totalTtd: number
  createdAt: string
  validUntil: string | null
  respondedAt: string | null
  publicToken: string
}

export async function getProfessionalQuotes(
  supabase: SupabaseClient<Database>
): Promise<QuoteListRow[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select(
      'id, customer_name, status, total_ttd, created_at, valid_until, responded_at, public_token'
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || !data) return []
  return data.map((q) => ({
    id: q.id,
    customerName: q.customer_name,
    status: q.status,
    totalTtd: q.total_ttd,
    createdAt: q.created_at,
    validUntil: q.valid_until,
    respondedAt: q.responded_at,
    publicToken: q.public_token,
  }))
}

export type QuoteDetail = QuoteListRow & {
  customerEmail: string | null
  customerPhone: string | null
  lineItems: QuoteLineItem[]
  subtotalTtd: number
  vatPercent: number
  vatAmountTtd: number
  notes: string | null
  responseNote: string | null
}

export async function getProfessionalQuote(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<QuoteDetail | null> {
  const { data, error } = await supabase.from('quotes').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null

  const rawItems = Array.isArray(data.line_items) ? (data.line_items as unknown[]) : []
  const lineItems: QuoteLineItem[] = rawItems.flatMap((item) => {
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

  return {
    id: data.id,
    customerName: data.customer_name,
    customerEmail: data.customer_email,
    customerPhone: data.customer_phone,
    status: data.status,
    totalTtd: data.total_ttd,
    subtotalTtd: data.subtotal_ttd,
    vatPercent: Number(data.vat_percent),
    vatAmountTtd: data.vat_amount_ttd,
    createdAt: data.created_at,
    validUntil: data.valid_until,
    respondedAt: data.responded_at,
    responseNote: data.response_note,
    notes: data.notes,
    publicToken: data.public_token,
    lineItems,
  }
}
