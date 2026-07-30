/**
 * POST /api/saved — the save toggle (playbook S084, pack api-marketplace §7).
 *
 * The properties under test are the toggle itself: insert-on, 23505-off, the
 * pack's `{ saved, count }` shape verbatim, and the recounted (never
 * incremented) count. Plus the gauntlet edges: role, schema, the no-legal-gate
 * deviation (flag F1), and no-status-leakage on the professional lookup.
 *
 * Modelled on tests/unit/connections-route.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('server-only', () => ({}))

const { createClientMock, createAdminClientMock, createBearerClientMock, checkRateLimitMock } =
  vi.hoisted(() => ({
    createClientMock: vi.fn(),
    createAdminClientMock: vi.fn(),
    createBearerClientMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
  }))

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))
vi.mock('@/lib/supabase/bearer', () => ({ createBearerClient: createBearerClientMock }))
vi.mock('@/lib/utils/logger', () => ({
  logger: { debug() {}, info() {}, warn() {}, error() {} },
  logSampled() {},
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: checkRateLimitMock }
})

import { POST } from '@/app/api/saved/route'

const PROFESSIONAL_ID = '3f0e2f6a-1111-4222-8333-444455556666'

type Options = {
  user?: { id: string } | null
  role?: string
  professional?: Record<string, unknown> | null
  /** What the saved_professionals INSERT answers. */
  insert?: 'ok' | 'duplicate' | 'error'
  deleteFails?: boolean
  /** The post-toggle recount. */
  count?: number
  /** Legal acceptances visible to the (unused) legal path — F1 assertion. */
  legal?: Array<{ document_type: string; document_version: string }>
}

function mockSupabase(options: Options) {
  const professional =
    options.professional === undefined ? { id: PROFESSIONAL_ID } : options.professional

  const client = {
    auth: {
      getUser: async () =>
        options.user === null
          ? { data: { user: null }, error: { message: 'no session' } }
          : { data: { user: options.user ?? { id: 'customer-1' } }, error: null },
    },
    from(table: string) {
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      builder.select = chain
      builder.eq = chain

      if (table === 'profiles') {
        builder.single = async () => ({
          data: {
            account_status: 'active',
            role: options.role ?? 'customer',
            professional_subtype: null,
          },
          error: null,
        })
        return builder
      }

      if (table === 'legal_acceptances') {
        builder.in = async () => ({ data: options.legal ?? [], error: null })
        return builder
      }

      if (table === 'professional_profiles') {
        builder.maybeSingle = async () => ({ data: professional, error: null })
        return builder
      }

      if (table === 'saved_professionals') {
        // Three awaited chains share this builder; a mode flag set by the
        // chain's verb keeps their resolutions apart: insert → the toggle-on
        // write, delete → the toggle-off write, select → the head-count.
        let mode: 'insert' | 'delete' | 'count' = 'count'
        builder.insert = () => {
          mode = 'insert'
          return builder
        }
        builder.delete = () => {
          mode = 'delete'
          return builder
        }
        builder.select = () => {
          mode = 'count'
          return builder
        }
        builder.then = (resolve: (v: unknown) => unknown) => {
          if (mode === 'insert') {
            const error =
              options.insert === 'duplicate'
                ? { code: '23505' }
                : options.insert === 'error'
                  ? { code: 'XX000' }
                  : null
            return Promise.resolve({ data: null, error }).then(resolve)
          }
          if (mode === 'delete') {
            return Promise.resolve({
              data: null,
              error: options.deleteFails ? { code: 'XX000' } : null,
            }).then(resolve)
          }
          return Promise.resolve({ data: null, error: null, count: options.count ?? 1 }).then(
            resolve
          )
        }
        return builder
      }

      builder.maybeSingle = async () => ({ data: null, error: null })
      return builder
    },
  }

  createClientMock.mockResolvedValue(client)
}

function saveRequest(body: unknown = { professional_id: PROFESSIONAL_ID }) {
  return new Request('http://localhost/api/saved', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/saved', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockResolvedValue({ ok: true, remaining: 30, degraded: false })
  })

  it('refuses an unauthenticated caller with 401 UNAUTHENTICATED', async () => {
    mockSupabase({ user: null })
    const res = await POST(saveRequest())
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.code).toBe('UNAUTHENTICATED')
  })

  it('refuses a professional caller with 403 FORBIDDEN_ROLE', async () => {
    mockSupabase({ role: 'professional' })
    const res = await POST(saveRequest())
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.code).toBe('FORBIDDEN_ROLE')
  })

  it('rejects a non-uuid professional_id at the schema', async () => {
    mockSupabase({})
    const res = await POST(saveRequest({ professional_id: 'not-a-uuid' }))
    expect(res.status).toBe(422)
  })

  it('rejects a non-JSON body with 422 INVALID_INPUT', async () => {
    mockSupabase({})
    const res = await POST(saveRequest('this is not json'))
    const body = await res.json()
    expect(res.status).toBe(422)
    expect(body.code).toBe('INVALID_INPUT')
  })

  it('answers 404 NOT_FOUND for a suspended or never-existed professional', async () => {
    // RLS returns no row for an inactive listing — indistinguishable from
    // never-existed, no status leakage.
    mockSupabase({ professional: null })
    const res = await POST(saveRequest())
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.code).toBe('NOT_FOUND')
    expect(body.details).toEqual({ resource: 'professional' })
  })

  it('toggles on: 200 { saved: true, count } in the pack §7 shape', async () => {
    mockSupabase({ insert: 'ok', count: 3 })
    const res = await POST(saveRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toEqual({ saved: true, count: 3 })
  })

  it('toggles off on the duplicate (23505): 200 { saved: false }', async () => {
    mockSupabase({ insert: 'duplicate', count: 2 })
    const res = await POST(saveRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toEqual({ saved: false, count: 2 })
  })

  it('saves without legal acceptances — a bookmark is not contact (flag F1)', async () => {
    // The connections canon would 403 here; the save deliberately does not.
    mockSupabase({ legal: [], insert: 'ok', count: 1 })
    const res = await POST(saveRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.saved).toBe(true)
  })

  it('returns the limiter response when rate-limited', async () => {
    mockSupabase({})
    checkRateLimitMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { code: 'RATE_LIMITED', error: 'Too many requests. Please try again shortly.' },
        { status: 429 }
      ),
    })
    const res = await POST(saveRequest())
    const body = await res.json()
    expect(res.status).toBe(429)
    expect(body.code).toBe('RATE_LIMITED')
    expect(checkRateLimitMock).toHaveBeenCalledWith('save', expect.any(String))
  })

  it('answers 500 INTERNAL on a non-duplicate insert failure', async () => {
    mockSupabase({ insert: 'error' })
    const res = await POST(saveRequest())
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.code).toBe('INTERNAL')
  })

  it('answers 500 INTERNAL when the toggle-off delete fails', async () => {
    mockSupabase({ insert: 'duplicate', deleteFails: true })
    const res = await POST(saveRequest())
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.code).toBe('INTERNAL')
  })
})
