/**
 * Quote domain helpers (playbook S109). Shared by the create/send routes and
 * the workspace composer so line-item maths lives in ONE place — the server
 * recomputes every total from the line items (the client's numbers are never
 * trusted, the "totals to server recompute" flag in api-operations.md §3.1).
 */
import { z } from 'zod'

/** A single quote line. `amount` is DERIVED, never accepted from the client. */
export const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(9999),
  unit_price: z.number().int().min(0).max(100_000_000),
})

export type QuoteLineItemInput = z.infer<typeof lineItemSchema>

export type QuoteLineItem = QuoteLineItemInput & { amount: number }

export const quoteDraftSchema = z.object({
  customer_name: z.string().trim().min(1).max(200),
  customer_email: z.string().trim().email().max(320).optional().or(z.literal('')),
  customer_phone: z.string().trim().max(40).optional().or(z.literal('')),
  line_items: z.array(lineItemSchema).min(1).max(50),
  vat_percent: z.number().min(0).max(100).default(0),
  valid_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
})

export type QuoteDraftInput = z.infer<typeof quoteDraftSchema>

export type QuoteTotals = {
  lineItems: QuoteLineItem[]
  subtotalTtd: number
  vatPercent: number
  vatAmountTtd: number
  totalTtd: number
}

/**
 * The single source of truth for quote arithmetic. `amount = quantity ×
 * unit_price` per line; subtotal is their sum; VAT is a whole-TTD round of the
 * percentage; total closes. Integer TTD throughout — the DB CHECK
 * (total = subtotal + vat) is the backstop this function is built to satisfy.
 */
export function computeQuoteTotals(items: QuoteLineItemInput[], vatPercent: number): QuoteTotals {
  const lineItems: QuoteLineItem[] = items.map((item) => ({
    ...item,
    amount: item.quantity * item.unit_price,
  }))
  const subtotalTtd = lineItems.reduce((sum, item) => sum + item.amount, 0)
  const vatAmountTtd = Math.round((subtotalTtd * vatPercent) / 100)
  return {
    lineItems,
    subtotalTtd,
    vatPercent,
    vatAmountTtd,
    totalTtd: subtotalTtd + vatAmountTtd,
  }
}
