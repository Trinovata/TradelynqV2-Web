import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { decodeCursor, encodeCursor } from '@/lib/marketplace/catalogue'

const ROW = {
  id: '3f0e2f6a-1111-4222-8333-444455556666',
  professional_id: 'x',
  image_urls: [],
  primary_image: null,
  caption: null,
  category: null,
  save_count: 0,
  created_at: '2026-07-24T12:00:00.000+00:00',
}

describe('catalogue cursor (S086)', () => {
  it('round-trips', () => {
    const decoded = decodeCursor(encodeCursor(ROW))
    expect(decoded).toEqual({ createdAt: ROW.created_at, id: ROW.id })
  })

  it('refuses a PostgREST filter injection in either part', () => {
    // The cursor is client-supplied and its parts are interpolated into an
    // .or() filter string — V1's injection class. A crafted cursor must read
    // as "no cursor", never reach the query builder.
    const inject = (createdAt: string, id: string) =>
      decodeCursor(Buffer.from(`${createdAt}|${id}`).toString('base64url'))

    expect(inject('2026-07-24T12:00:00Z),or(is_approved.eq.false', ROW.id)).toBeNull()
    expect(inject(ROW.created_at, 'not-a-uuid,is_approved.eq.false')).toBeNull()
    expect(inject('', '')).toBeNull()
  })

  it('refuses garbage and non-base64 input', () => {
    expect(decodeCursor('!!!not-base64!!!')).toBeNull()
    expect(decodeCursor(Buffer.from('no-separator-here').toString('base64url'))).toBeNull()
  })

  it('accepts both ISO offset styles Postgres emits', () => {
    expect(
      decodeCursor(Buffer.from(`2026-07-24 12:00:00+00|${ROW.id}`).toString('base64url'))
    ).not.toBeNull()
    expect(
      decodeCursor(Buffer.from(`2026-07-24T12:00:00.123456Z|${ROW.id}`).toString('base64url'))
    ).not.toBeNull()
  })
})
