import { describe, expect, it } from 'vitest'
import { computeQuoteTotals, quoteDraftSchema } from '@/lib/quotes'

describe('computeQuoteTotals (S109 — server-recomputed money)', () => {
  it('derives amount per line and sums the subtotal', () => {
    const t = computeQuoteTotals(
      [
        { description: 'AC service', quantity: 3, unit_price: 250 },
        { description: 'Gas top-up', quantity: 1, unit_price: 400 },
      ],
      0
    )
    expect(t.lineItems[0]?.amount).toBe(750)
    expect(t.lineItems[1]?.amount).toBe(400)
    expect(t.subtotalTtd).toBe(1150)
    expect(t.vatAmountTtd).toBe(0)
    expect(t.totalTtd).toBe(1150)
  })

  it('rounds VAT to whole TTD and closes the total (the DB CHECK invariant)', () => {
    const t = computeQuoteTotals([{ description: 'x', quantity: 1, unit_price: 333 }], 12.5)
    // 333 × 12.5% = 41.625 → 42
    expect(t.vatAmountTtd).toBe(42)
    expect(t.totalTtd).toBe(t.subtotalTtd + t.vatAmountTtd)
  })

  it('never trusts a client-supplied amount — it is always derived', () => {
    // Even if a caller smuggled an `amount`, the schema drops it and the
    // function recomputes from quantity × unit_price.
    const parsed = quoteDraftSchema.parse({
      customer_name: 'Dev Maharaj',
      line_items: [{ description: 'x', quantity: 2, unit_price: 100, amount: 999999 }],
    })
    // @ts-expect-error — amount is not part of the parsed line shape
    expect(parsed.line_items[0].amount).toBeUndefined()
    const t = computeQuoteTotals(parsed.line_items, parsed.vat_percent)
    expect(t.totalTtd).toBe(200)
  })

  it('rejects an empty line list and a zero-length description', () => {
    expect(quoteDraftSchema.safeParse({ customer_name: 'x', line_items: [] }).success).toBe(false)
    expect(
      quoteDraftSchema.safeParse({
        customer_name: 'x',
        line_items: [{ description: '', quantity: 1, unit_price: 5 }],
      }).success
    ).toBe(false)
  })
})
