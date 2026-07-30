import { describe, it, expect } from 'vitest'
import {
  EVENT_REGISTRY,
  EVENT_TYPES,
  eventsByGroup,
  isEventType,
  EVENT_GROUPS,
} from '@/lib/events/catalog'

describe('event catalog', () => {
  it('exposes every registry key as an event type', () => {
    expect(EVENT_TYPES.sort()).toEqual(Object.keys(EVENT_REGISTRY).sort())
    expect(EVENT_TYPES.length).toBeGreaterThan(0)
  })

  it('groups every event under a known group, losing none', () => {
    const grouped = eventsByGroup()
    const flattened = EVENT_GROUPS.flatMap((g) => grouped[g].map((e) => e.type))
    expect(flattened.sort()).toEqual([...EVENT_TYPES].sort())
    for (const type of EVENT_TYPES) {
      expect(EVENT_GROUPS).toContain(EVENT_REGISTRY[type].group)
    }
  })

  it('guards untrusted strings with isEventType', () => {
    expect(isEventType('job.completed')).toBe(true)
    expect(isEventType('not.an.event')).toBe(false)
    expect(isEventType('constructor')).toBe(false) // prototype-walk guard
  })

  it('validates a well-formed payload and rejects a malformed one', () => {
    const good = EVENT_REGISTRY['job.completed'].schema.safeParse({
      job_id: '11111111-1111-4111-8111-111111111111',
      customer_name: 'Lisa',
      title: 'Fix leaking pipe',
      completed_at: '2026-07-28T14:00:00.000Z',
    })
    expect(good.success).toBe(true)

    const bad = EVENT_REGISTRY['job.completed'].schema.safeParse({
      job_id: 'not-a-uuid',
      customer_name: 'Lisa',
    })
    expect(bad.success).toBe(false)
  })

  it('carries money as a TTD number with an explicit currency', () => {
    const parsed = EVENT_REGISTRY['invoice.created'].schema.safeParse({
      invoice_id: '11111111-1111-4111-8111-111111111111',
      invoice_number: 'INV-0001',
      customer_name: 'Lisa',
      amount_ttd: 1200,
      currency: 'TTD',
      created_at: '2026-07-28T14:00:00.000Z',
    })
    expect(parsed.success).toBe(true)
    // USD is not a valid currency on the platform.
    const usd = EVENT_REGISTRY['invoice.created'].schema.safeParse({
      invoice_id: '11111111-1111-4111-8111-111111111111',
      invoice_number: 'INV-0001',
      customer_name: 'Lisa',
      amount_ttd: 1200,
      currency: 'USD',
      created_at: '2026-07-28T14:00:00.000Z',
    })
    expect(usd.success).toBe(false)
  })
})
