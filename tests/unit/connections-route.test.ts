/**
 * POST /api/connections — the contact reveal (playbook S083, pack
 * api-marketplace §3, flow v2/08 §8.1).
 *
 * The properties under test are the gate ladder itself: counts 0/1 reveal free,
 * count 2 unverified refuses with an actionable KYC payload, verified is
 * unlimited, and a duplicate reveal is a no-op that never burns the counter.
 * The pure gate maths is already covered in access.test.ts; these tests cover
 * the ROUTE — code/status/details on the wire, the redacted-until-verified
 * contact, and the server-side analytics emissions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { createClientMock, createAdminClientMock, createBearerClientMock, logActivityMock } =
  vi.hoisted(() => ({
    createClientMock: vi.fn(),
    createAdminClientMock: vi.fn(),
    createBearerClientMock: vi.fn(),
    logActivityMock: vi.fn(async () => {}),
  }))

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))
vi.mock('@/lib/supabase/bearer', () => ({ createBearerClient: createBearerClientMock }))
vi.mock('@/lib/utils/logger', () => ({
  logger: { debug() {}, info() {}, warn() {}, error() {} },
  logSampled() {},
}))
vi.mock('@/lib/analytics/server', () => ({
  logActivity: logActivityMock,
  flushAnalytics: vi.fn(async () => {}),
}))

import { POST } from '@/app/api/connections/route'
import { CURRENT_LEGAL_VERSIONS, CUSTOMER_CONTACT_LEGAL } from '@/lib/access/api'

const PROFESSIONAL_ID = '3f0e2f6a-1111-4222-8333-444455556666'

/** All customer-contact documents accepted at their in-force versions. */
function fullLegal() {
  return CUSTOMER_CONTACT_LEGAL.map((type) => ({
    document_type: type,
    document_version: CURRENT_LEGAL_VERSIONS[type],
  }))
}

type Options = {
  user?: { id: string } | null
  role?: string
  professional?: Record<string, unknown> | null
  legal?: Array<{ document_type: string; document_version: string }>
  /**
   * customer_profiles reads, consumed in order: the gate check first, then the
   * fresh post-insert count. The last entry repeats when the queue runs dry.
   */
  customerProfiles?: Array<{ connection_count: number; kyc_status: string }>
  /** Existing (customer, professional) pair rows — the gate's free-repeat path. */
  pairCount?: number
  insert?: 'ok' | 'duplicate'
}

function mockSupabase(options: Options) {
  const professional =
    options.professional === undefined
      ? {
          id: PROFESSIONAL_ID,
          contact_phone: '+1 868 374 1234',
          contact_whatsapp: '868 355 2214',
        }
      : options.professional
  const profileReads = [...(options.customerProfiles ?? [])]

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
        builder.in = async () => ({ data: options.legal ?? fullLegal(), error: null })
        return builder
      }

      if (table === 'professional_profiles') {
        builder.maybeSingle = async () => ({ data: professional, error: null })
        return builder
      }

      if (table === 'customer_profiles') {
        builder.maybeSingle = async () => ({
          data: profileReads.length > 1 ? profileReads.shift() : (profileReads[0] ?? null),
          error: null,
        })
        return builder
      }

      if (table === 'connections') {
        // Head-count await (the gate's pair check) resolves through `then`;
        // the INSERT terminal is `.single()`; the existing-pair read is
        // `.maybeSingle()`. Three different terminals, no ambiguity.
        builder.insert = () => builder
        builder.single = async () =>
          options.insert === 'duplicate'
            ? { data: null, error: { code: '23505' } }
            : { data: { id: 'conn-new' }, error: null }
        builder.maybeSingle = async () => ({ data: { id: 'conn-existing' }, error: null })
        builder.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null, count: options.pairCount ?? 0 }).then(resolve)
        return builder
      }

      builder.maybeSingle = async () => ({ data: null, error: null })
      return builder
    },
  }

  createClientMock.mockResolvedValue(client)
}

function revealRequest(body: unknown = { professional_id: PROFESSIONAL_ID }) {
  return new Request('http://localhost/api/connections', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/connections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refuses an unauthenticated caller with 401 UNAUTHENTICATED', async () => {
    mockSupabase({ user: null })
    const res = await POST(revealRequest())
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.code).toBe('UNAUTHENTICATED')
  })

  it('refuses a professional caller with 403 FORBIDDEN_ROLE', async () => {
    mockSupabase({ role: 'professional' })
    const res = await POST(revealRequest())
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.code).toBe('FORBIDDEN_ROLE')
  })

  it('rejects a non-uuid professional_id at the schema', async () => {
    mockSupabase({})
    const res = await POST(revealRequest({ professional_id: 'not-a-uuid' }))
    expect(res.status).toBe(422)
  })

  it('answers 404 NOT_FOUND for a suspended or never-existed professional', async () => {
    // RLS returns no row for an inactive listing — the flow's 404-equivalent,
    // indistinguishable from never-existed (no status leakage).
    mockSupabase({ professional: null })
    const res = await POST(revealRequest())
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.code).toBe('NOT_FOUND')
    expect(body.details).toEqual({ resource: 'professional' })
  })

  it('refuses with LEGAL_ACCEPTANCE_REQUIRED and the missing set before the gate', async () => {
    mockSupabase({
      legal: [],
      customerProfiles: [{ connection_count: 0, kyc_status: 'not_required' }],
    })
    const res = await POST(revealRequest())
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.code).toBe('LEGAL_ACCEPTANCE_REQUIRED')
    expect(body.details.missingDocuments).toEqual(
      expect.arrayContaining(['privacy', 'terms', 'reviews'])
    )
  })

  it('refuses at 2 used + unverified with the actionable KYC payload, and emits kyc_prompted', async () => {
    mockSupabase({
      customerProfiles: [{ connection_count: 2, kyc_status: 'not_required' }],
      pairCount: 0,
    })
    const res = await POST(revealRequest())
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.code).toBe('KYC_REQUIRED')
    expect(body.details).toEqual({ reason: 'connection_limit_reached', connectionsUsed: 2 })
    // Server-layer analytics: the funnel's kyc_prompted step is emitted here,
    // never trusted from the client.
    expect(logActivityMock).toHaveBeenCalledWith('kyc_prompted', {}, expect.anything())
  })

  it('reveals below the allowance: connection id, fresh count, contact present', async () => {
    mockSupabase({
      customerProfiles: [
        { connection_count: 0, kyc_status: 'not_required' }, // gate read
        { connection_count: 1, kyc_status: 'not_required' }, // fresh post-insert read
      ],
      pairCount: 0,
      insert: 'ok',
    })
    const res = await POST(revealRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toMatchObject({
      success: true,
      existing: false,
      connectionId: 'conn-new',
      connection_count: 1,
      kyc_required: false,
      contact: { phone: '+1 868 374 1234', whatsapp: '868 355 2214' },
    })
    expect(logActivityMock).toHaveBeenCalledWith(
      'reveal_completed',
      expect.objectContaining({ professional_id: PROFESSIONAL_ID, connection_number: 1 }),
      expect.anything()
    )
  })

  it('treats a duplicate reveal as a 200 no-op that never burns the counter', async () => {
    mockSupabase({
      customerProfiles: [{ connection_count: 2, kyc_status: 'not_required' }],
      // The pair already exists, so even a customer AT the limit passes free —
      // the gate must not charge twice for one relationship.
      pairCount: 1,
      insert: 'duplicate',
    })
    const res = await POST(revealRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toMatchObject({
      success: true,
      existing: true,
      connectionId: 'conn-existing',
      connection_count: 2, // unchanged
    })
    // A repeat is not a new reveal_success.
    expect(logActivityMock).not.toHaveBeenCalledWith(
      'reveal_completed',
      expect.anything(),
      expect.anything()
    )
  })

  it('reveals without limit once verified — count 900 still passes', async () => {
    mockSupabase({
      customerProfiles: [
        { connection_count: 900, kyc_status: 'verified' },
        { connection_count: 901, kyc_status: 'verified' },
      ],
      pairCount: 0,
      insert: 'ok',
    })
    const res = await POST(revealRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.connection_count).toBe(901)
    expect(body.data.contact.phone).toBeTruthy()
  })
})
