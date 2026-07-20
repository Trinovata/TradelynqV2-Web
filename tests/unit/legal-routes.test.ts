/**
 * Legal acceptance routes (playbook S057).
 *
 * The gate these feed is a legal one: a customer cannot contact a professional
 * until the in-force Terms and Privacy Policy are accepted. So the properties
 * that matter are that a stale-version acceptance does NOT satisfy the gate, that
 * the evidentiary fields are captured server-side rather than trusted from the
 * body, that re-acceptance is idempotent, and that a database error fails closed
 * rather than waving the user through.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { createClientMock, createAdminClientMock, createBearerClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  createBearerClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))
vi.mock('@/lib/supabase/bearer', () => ({ createBearerClient: createBearerClientMock }))
vi.mock('@/lib/utils/logger', () => ({
  logger: { debug() {}, info() {}, warn() {}, error() {} },
  logSampled() {},
}))

import { GET as legalStatus } from '@/app/api/legal/status/route'
import { POST as legalAccept } from '@/app/api/legal/accept/route'
import { CURRENT_LEGAL_VERSIONS } from '@/lib/access/api'

// ── Supabase double ──────────────────────────────────────────────────────────
//
// Records upsert payloads so the test can assert what was written (evidence
// fields), and answers the acceptances SELECT from a controllable row set.

type Row = { document_type: string; document_version: string }

function mockSupabase(options: {
  accountStatus?: string
  acceptances?: Row[]
  upsertError?: boolean
}) {
  const upserts: Array<{ rows: unknown; opts: unknown }> = []
  let acceptances = options.acceptances ?? []

  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    from(table: string) {
      const builder: Record<string, unknown> = {}
      // Terminal for the profiles account_status lookup in requireAuth.
      if (table === 'profiles') {
        builder.select = () => builder
        builder.eq = () => builder
        builder.single = async () => ({
          data: { account_status: options.accountStatus ?? 'active' },
          error: null,
        })
        return builder
      }
      // legal_acceptances: select chain resolves to the row set; upsert records.
      builder.select = () => builder
      builder.eq = () => builder
      builder.in = async () => ({ data: acceptances, error: null })
      builder.upsert = (rows: unknown, opts: unknown) => {
        upserts.push({ rows, opts })
        if (!options.upsertError) {
          // Reflect the write into the readable set so a subsequent re-read sees it.
          acceptances = (rows as Row[]).map((r) => ({
            document_type: r.document_type,
            document_version: r.document_version,
          }))
        }
        return {
          then: (res: (v: unknown) => unknown) =>
            Promise.resolve({ error: options.upsertError ? { code: 'XX000' } : null }).then(res),
        }
      }
      return builder
    },
  }

  createClientMock.mockResolvedValue(client)
  return { upserts }
}

function acceptReq(documents: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/legal/accept', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ documents }),
  })
}

describe('GET /api/legal/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reports everything missing when no acceptances exist', async () => {
    mockSupabase({ acceptances: [] })
    const res = await legalStatus(new Request('http://localhost/api/legal/status'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.accepted).toBe(false)
    expect(body.data.missing_documents).toEqual(['privacy', 'terms', 'eula', 'reviews'])
  })

  it('reports accepted when every in-force version is present', async () => {
    mockSupabase({
      acceptances: [
        { document_type: 'privacy', document_version: CURRENT_LEGAL_VERSIONS.privacy },
        { document_type: 'terms', document_version: CURRENT_LEGAL_VERSIONS.terms },
        { document_type: 'eula', document_version: CURRENT_LEGAL_VERSIONS.eula },
        { document_type: 'reviews', document_version: CURRENT_LEGAL_VERSIONS.reviews },
      ],
    })
    const res = await legalStatus(new Request('http://localhost/api/legal/status'))
    const body = await res.json()

    expect(body.data.accepted).toBe(true)
    expect(body.data.missing_documents).toEqual([])
  })

  it('still lists a document accepted at a SUPERSEDED version as missing', async () => {
    // The whole reason acceptance is versioned. Accepting Terms v0.9 does not
    // satisfy the in-force version.
    mockSupabase({
      acceptances: [{ document_type: 'terms', document_version: '0.9' }],
    })
    const res = await legalStatus(new Request('http://localhost/api/legal/status'))
    const body = await res.json()

    expect(body.data.missing_documents).toContain('terms')
  })

  it('fails closed with 500 when the lookup errors', async () => {
    // An unreadable acceptances table must NOT read as "nothing outstanding".
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
      from(table: string) {
        const b: Record<string, unknown> = {}
        if (table === 'profiles') {
          b.select = () => b
          b.eq = () => b
          b.single = async () => ({ data: { account_status: 'active' }, error: null })
          return b
        }
        b.select = () => b
        b.eq = () => b
        b.in = async () => ({ data: null, error: { code: '08006' } })
        return b
      },
    }
    createClientMock.mockResolvedValue(client)

    const res = await legalStatus(new Request('http://localhost/api/legal/status'))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/legal/accept', () => {
  beforeEach(() => vi.clearAllMocks())

  it('records each document at its in-force version with server-captured evidence', async () => {
    const { upserts } = mockSupabase({ acceptances: [] })

    const res = await legalAccept(
      acceptReq(['privacy', 'terms'], { 'x-real-ip': '10.0.0.5', 'user-agent': 'TestAgent/1.0' })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.accepted).toEqual(['privacy', 'terms'])

    const rows = upserts[0]?.rows as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      user_id: 'user-1',
      document_type: 'privacy',
      document_version: CURRENT_LEGAL_VERSIONS.privacy,
      ip_address: '10.0.0.5',
      user_agent: 'TestAgent/1.0',
    })
  })

  it('ignores IP or version supplied in the body — evidence is server-side only', async () => {
    const { upserts } = mockSupabase({ acceptances: [] })

    // A malicious body trying to backdate or forge the record.
    await legalAccept(
      new Request('http://localhost/api/legal/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': '10.0.0.5' },
        body: JSON.stringify({
          documents: ['terms'],
          document_version: '0.1',
          ip_address: '1.1.1.1',
          accepted_at: '2001-01-01',
        }),
      })
    )

    const rows = upserts[0]?.rows as Array<Record<string, unknown>>
    expect(rows[0]?.document_version).toBe(CURRENT_LEGAL_VERSIONS.terms) // not '0.1'
    expect(rows[0]?.ip_address).toBe('10.0.0.5') // not '1.1.1.1'
    expect(rows[0]).not.toHaveProperty('accepted_at') // DB default owns the timestamp
  })

  it('de-duplicates a document listed twice', async () => {
    const { upserts } = mockSupabase({ acceptances: [] })
    await legalAccept(acceptReq(['terms', 'terms', 'terms']))
    const rows = upserts[0]?.rows as unknown[]
    expect(rows).toHaveLength(1)
  })

  it('is idempotent — re-accepting uses ignoreDuplicates', async () => {
    const { upserts } = mockSupabase({ acceptances: [] })
    await legalAccept(acceptReq(['terms']))
    const opts = upserts[0]?.opts as { ignoreDuplicates?: boolean; onConflict?: string }
    expect(opts.ignoreDuplicates).toBe(true)
    expect(opts.onConflict).toBe('user_id,document_type,document_version')
  })

  it('rejects a document outside the known set at the schema', async () => {
    mockSupabase({ acceptances: [] })
    const res = await legalAccept(acceptReq(['terms', 'not_a_document']))
    expect(res.status).toBe(422)
  })

  it('rejects an empty documents array', async () => {
    mockSupabase({ acceptances: [] })
    const res = await legalAccept(acceptReq([]))
    expect(res.status).toBe(422)
  })

  it('fails closed with 500 when the upsert errors', async () => {
    mockSupabase({ acceptances: [], upsertError: true })
    const res = await legalAccept(acceptReq(['terms']))
    expect(res.status).toBe(500)
  })

  it('returns the still-outstanding documents so the client knows when to close the modal', async () => {
    // Accepting only privacy+terms leaves eula+reviews outstanding.
    const { upserts } = mockSupabase({ acceptances: [] })
    const res = await legalAccept(acceptReq(['privacy', 'terms']))
    const body = await res.json()
    expect(upserts).toHaveLength(1)
    expect(body.data.missing_documents).toEqual(expect.arrayContaining(['eula', 'reviews']))
  })
})
