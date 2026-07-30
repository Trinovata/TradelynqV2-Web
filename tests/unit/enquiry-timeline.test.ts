import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { enquiryTimeline, type CustomerEnquiryDetail } from '@/lib/enquiries/queries'

function detail(over: Partial<CustomerEnquiryDetail>): CustomerEnquiryDetail {
  return {
    id: 'e1',
    status: 'pending',
    description: 'x',
    preferred_date: null,
    created_at: '2026-07-20T10:00:00Z',
    accepted_at: null,
    completed_at: null,
    declined_reason: null,
    contact_preference: 'whatsapp',
    professional: null,
    hasReview: false,
    ...over,
  }
}

describe('enquiryTimeline (S098)', () => {
  it('a pending enquiry shows only the submitted step', () => {
    const events = enquiryTimeline(detail({ status: 'pending' }))
    expect(events.map((e) => e.id)).toEqual(['submitted'])
  })

  it('a declined enquiry ends at declined and carries the reason verbatim', () => {
    const events = enquiryTimeline(
      detail({ status: 'declined', declined_reason: 'Booked that week, sorry.' })
    )
    expect(events.map((e) => e.id)).toEqual(['submitted', 'declined'])
    expect(events[1]?.detail).toBe('Booked that week, sorry.')
    expect(events[1]?.status).toBe('declined')
  })

  it('a completed enquiry shows the full accepted → completed chain', () => {
    const events = enquiryTimeline(
      detail({
        status: 'completed',
        accepted_at: '2026-07-21T09:00:00Z',
        completed_at: '2026-07-25T16:00:00Z',
      })
    )
    expect(events.map((e) => e.id)).toEqual(['submitted', 'accepted', 'completed'])
    // A superseded accepted step reads done, not live.
    expect(events[1]?.status).toBe('completed')
  })

  it('the live accepted step reads accent, not done', () => {
    const events = enquiryTimeline(
      detail({ status: 'accepted', accepted_at: '2026-07-21T09:00:00Z' })
    )
    expect(events.find((e) => e.id === 'accepted')?.status).toBe('accepted')
  })

  it('an in-progress enquiry inserts the in_progress step', () => {
    const events = enquiryTimeline(
      detail({ status: 'in_progress', accepted_at: '2026-07-21T09:00:00Z' })
    )
    expect(events.map((e) => e.id)).toEqual(['submitted', 'accepted', 'in_progress'])
  })
})
