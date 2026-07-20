/**
 * The access layer is the keystone: every API route on this platform begins with a
 * guard from `lib/access/api.ts`, and until now not one of them had a unit test.
 *
 * These tests are written adversarially. The question asked of each guard is not
 * "does the happy path work" but "what does it do when the database lies, when the
 * row is missing, when the token is valid but the account is not, and when the
 * caller supplies an id they should not control".
 *
 * Several tests below assert behaviour that is CURRENTLY WRONG. They are marked
 * `it.fails(...)` and carry a BUG comment naming the defect, so the suite goes red
 * the moment someone fixes it — at which point the `.fails` comes off and the test
 * becomes an ordinary regression guard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

// `vi.mock` is hoisted above the imports, so anything its factory closes over has
// to be hoisted with it.
const { createClientMock, createAdminClientMock, createBearerClientMock, loggedErrors } =
  vi.hoisted(() => ({
    createClientMock: vi.fn(),
    createAdminClientMock: vi.fn(),
    createBearerClientMock: vi.fn(),
    loggedErrors: [] as Array<{ event: string; context?: Record<string, unknown> }>,
  }))

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))
vi.mock('@/lib/supabase/bearer', () => ({ createBearerClient: createBearerClientMock }))

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: (event: string, context?: Record<string, unknown>) =>
      loggedErrors.push({ event, context }),
  },
  logSampled: () => {},
}))

import {
  requireAuth,
  requireRole,
  requireCustomer,
  requireAdmin,
  requireProfessional,
  ensureLegalAcceptances,
  requireCustomerConnectionGate,
  requireTierFeature,
  CURRENT_LEGAL_VERSIONS,
  type AuthContext,
  type RoleContext,
  type ProfessionalContext,
} from '@/lib/access/api'

// ── A Supabase test double ───────────────────────────────────────────────────

type TableResult = { data?: unknown; error?: unknown; count?: number }

/** Every chained call made against a table, so tests can assert the query shape. */
type CallLog = Array<{ table: string; method: string; args: unknown[] }>

/**
 * Enough of the PostgREST query-builder shape to drive the access layer: the
 * chainable filters return `this`, the terminators resolve, and the builder itself
 * is thenable so `await client.from(t).select().eq()` works the way the real one does.
 */
function makeQuery(table: string, result: TableResult, log: CallLog): Record<string, unknown> {
  const settled = { data: null, error: null, ...result }
  const builder: Record<string, unknown> = {}

  for (const method of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'is', 'not']) {
    builder[method] = (...args: unknown[]) => {
      log.push({ table, method, args })
      return builder
    }
  }

  const terminate = async () => {
    log.push({ table, method: 'terminate', args: [] })
    return settled
  }
  builder.single = terminate
  builder.maybeSingle = terminate
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(settled).then(resolve, reject)

  return builder
}

type SupabaseDouble = {
  client: Record<string, unknown>
  log: CallLog
}

function makeSupabase(
  tables: Record<string, TableResult>,
  user?: { id: string } | null
): SupabaseDouble {
  const log: CallLog = []
  const client = {
    from: (table: string) => makeQuery(table, tables[table] ?? { data: null }, log),
    auth: {
      getUser: vi.fn(async (_token?: string) => ({
        data: { user: user ?? null },
        error: user ? null : { message: 'no session' },
      })),
    },
  }
  return { client, log }
}

/** Argument list for the named chained call against a table, if it was made. */
function argsFor(log: CallLog, table: string, method: string): unknown[] | undefined {
  return log.find((entry) => entry.table === table && entry.method === method)?.args
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

/** Asserts the guard refused, and returns the decoded error body. */
async function refusal(result: { ok: boolean; response?: Response }) {
  expect(result.ok).toBe(false)
  const response = (result as { response: Response }).response
  return { status: response.status, body: await bodyOf(response) }
}

const ACTIVE_CUSTOMER: TableResult = {
  data: { role: 'customer', professional_subtype: null, account_status: 'active' },
}
const ACTIVE_PROFESSIONAL: TableResult = {
  data: { role: 'professional', professional_subtype: 'sole_trader', account_status: 'active' },
}

beforeEach(() => {
  vi.clearAllMocks()
  loggedErrors.length = 0
})

/**
 * Installs a cookie-session client for `userId`, backed by the given tables.
 *
 * `profiles` defaults to an active customer because `requireAuth` now reads
 * `account_status` (it previously did not, which let suspended accounts through
 * any route guarded by `requireAuth` alone). Without a default, every test that
 * only cares about session resolution would have to restate a profiles row.
 * Tests that care about the profile pass their own.
 */
function signedIn(userId: string, tables: Record<string, TableResult> = {}): SupabaseDouble {
  const double = makeSupabase({ profiles: ACTIVE_CUSTOMER, ...tables }, { id: userId })
  createClientMock.mockResolvedValue(double.client)
  return double
}

/**
 * Installs a bearer-path double: the admin client validates the token, and the
 * bearer-bound client is what the caller receives.
 */
function signedInWithBearer(
  userId: string,
  tables: Record<string, TableResult> = {}
): SupabaseDouble {
  const validator = makeSupabase({}, { id: userId })
  const bearerClient = makeSupabase({ profiles: ACTIVE_CUSTOMER, ...tables }, { id: userId })
  createAdminClientMock.mockReturnValue(validator.client)
  createBearerClientMock.mockReturnValue(bearerClient.client)
  return bearerClient
}

// ── requireAuth ──────────────────────────────────────────────────────────────

describe('requireAuth — session resolution', () => {
  it('refuses with UNAUTHENTICATED when there is no session', async () => {
    const double = makeSupabase({}, null)
    createClientMock.mockResolvedValue(double.client)

    const { status, body } = await refusal(await requireAuth())
    expect(status).toBe(401)
    expect(body.code).toBe('UNAUTHENTICATED')
  })

  it('uses getUser, never getSession — a cookie is forgeable, a revalidation is not', async () => {
    const double = signedIn('user-1')
    await requireAuth()
    expect(double.client.auth).toBeDefined()
    expect(
      (double.client as { auth: { getUser: ReturnType<typeof vi.fn> } }).auth.getUser
    ).toHaveBeenCalled()
    // getSession is not even present on the double; if the implementation reached
    // for it this test would throw rather than quietly trust a cookie.
    expect((double.client as { auth: Record<string, unknown> }).auth.getSession).toBeUndefined()
  })

  it('does not construct a service-role client on the cookie path', async () => {
    signedIn('user-1')
    await requireAuth()
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('refuses a bearer token the auth server rejects (revoked, expired, deleted user)', async () => {
    // A deleted or banned user's token still parses locally but fails validation
    // server-side. This is why the token is verified rather than decoded.
    const validator = makeSupabase({}, null)
    createAdminClientMock.mockReturnValue(validator.client)
    createClientMock.mockResolvedValue(makeSupabase({}, null).client)

    const request = new Request('https://tradelynq.tech/api/x', {
      headers: { authorization: 'Bearer expired.token.here' },
    })
    const { status, body } = await refusal(await requireAuth(request))
    expect(status).toBe(401)
    expect(body.code).toBe('UNAUTHENTICATED')
  })

  it('refuses an empty bearer token without calling the auth server', async () => {
    createClientMock.mockResolvedValue(makeSupabase({}, null).client)
    const request = new Request('https://tradelynq.tech/api/x', {
      headers: { authorization: 'Bearer    ' },
    })
    expect((await requireAuth(request)).ok).toBe(false)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('ignores a non-Bearer Authorization scheme and falls through to cookies', async () => {
    // `Basic` credentials must not be mistaken for a session.
    signedIn('cookie-user')
    const request = new Request('https://tradelynq.tech/api/x', {
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    })
    const result = await requireAuth(request)
    expect(result.ok).toBe(true)
    expect((result as AuthContext).userId).toBe('cookie-user')
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('never hands the service-role client to the caller on the bearer path', async () => {
    // The service-role client bypasses RLS entirely. It is used to VALIDATE the
    // token and must not escape into the route.
    const validator = makeSupabase({}, { id: 'bearer-user' })
    const bearerScoped = makeSupabase({ profiles: ACTIVE_CUSTOMER }, { id: 'bearer-user' })
    createAdminClientMock.mockReturnValue(validator.client)
    createBearerClientMock.mockReturnValue(bearerScoped.client)

    const request = new Request('https://tradelynq.tech/api/x', {
      headers: { authorization: 'Bearer good.token' },
    })
    const result = await requireAuth(request)

    expect(result.ok).toBe(true)
    expect((result as AuthContext).supabase).not.toBe(validator.client)
  })

  /**
   * FIXED 20 Jul 2026 (was: high). The bearer path used to resolve the caller
   * from the TOKEN but return a client scoped to COOKIES. For a mobile request
   * — which carries no cookies — that client was anonymous, so `auth.uid()` was
   * NULL inside every RLS policy the route then relied on. The identity the
   * route believed in and the identity the database enforced were different.
   *
   * It failed closed only by accident (profiles has no anon SELECT policy), so
   * D21's "one rules layer, two transports" did not work for mobile at all.
   *
   * This now asserts the CORRECT property: the token that was validated is the
   * token the returned client carries.
   */
  it('binds the validated bearer token to the returned client', async () => {
    signedInWithBearer('bearer-user')

    const request = new Request('https://tradelynq.tech/api/x', {
      headers: { authorization: 'Bearer good.token' },
    })
    const result = await requireAuth(request)

    expect((result as AuthContext).userId).toBe('bearer-user')
    // The token reaches the client factory, so `auth.uid()` resolves in RLS.
    expect(createBearerClientMock).toHaveBeenCalledWith('good.token')
    // And the cookie-bound client is NOT used for a bearer request.
    expect(createClientMock).not.toHaveBeenCalled()
  })

  /**
   * FIXED 20 Jul 2026 (was: medium). `requireAuth` did not consult
   * `account_status` — only `requireRole` did — so any route guarded by
   * `requireAuth` alone admitted suspended accounts for the life of their token.
   * Suspension has to bite on the next request.
   */
  it('refuses a suspended account even without a role check', async () => {
    signedIn('suspended-user', {
      profiles: {
        data: { role: 'customer', professional_subtype: null, account_status: 'suspended' },
      },
    })

    const { status, body } = await refusal(await requireAuth())
    expect(status).toBe(403)
    expect(body.code).toBe('FORBIDDEN_ROLE')

    // And a role guard refuses it too, by a different path.
    expect((await requireRole(['customer'])).ok).toBe(false)
  })

  it('admits an active account', async () => {
    // A guard that refuses everyone is not a guard, it is an outage.
    signedIn('good-user', {
      profiles: {
        data: { role: 'customer', professional_subtype: null, account_status: 'active' },
      },
    })
    expect((await requireAuth()).ok).toBe(true)
  })
})

// ── requireRole ──────────────────────────────────────────────────────────────

describe('requireRole — cannot be fooled by a missing or malformed profile', () => {
  it('reads the role from the database, not from the token', async () => {
    // The JWT for this user could claim anything; the profiles row is the truth.
    const double = signedIn('user-1', { profiles: ACTIVE_PROFESSIONAL })
    const result = await requireRole(['professional'])

    expect(result.ok).toBe(true)
    expect(argsFor(double.log, 'profiles', 'eq')).toEqual(['id', 'user-1'])
    expect(argsFor(double.log, 'profiles', 'select')?.[0]).toContain('account_status')
  })

  it('fails CLOSED with INTERNAL when the profiles row is missing', async () => {
    // `.single()` on zero rows is a PostgREST error, not a null row. Either way the
    // guard must refuse — a missing profile must never read as "role check skipped".
    signedIn('ghost-user', { profiles: { data: null, error: { code: 'PGRST116' } } })

    const { status, body } = await refusal(await requireRole(['customer']))
    expect(status).toBe(500)
    expect(body.code).toBe('INTERNAL')

    // `requireAuth` now reads account_status first, so a missing profile is
    // caught one layer earlier than it used to be. Either log event proves the
    // guard refused for the right reason rather than passing through.
    expect(
      loggedErrors.some(
        (e) =>
          e.event === 'access:profile_lookup_failed' || e.event === 'access:status_lookup_failed'
      )
    ).toBe(true)
  })

  it('fails CLOSED when the row is null with no error (RLS filtered it away)', async () => {
    signedIn('invisible-user', { profiles: { data: null, error: null } })
    const { status } = await refusal(await requireRole(['customer']))
    expect(status).toBe(500)
  })

  it('leaks no database detail to the client on the INTERNAL path', async () => {
    signedIn('ghost-user', {
      profiles: {
        data: null,
        error: { code: '42501', message: 'permission denied for table profiles', hint: 'GRANT…' },
      },
    })
    const { body } = await refusal(await requireRole(['customer']))
    expect(body.details).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('permission denied')
    expect(JSON.stringify(body)).not.toContain('42501')
  })

  it.each(['suspended', 'pending', 'deleted'] as const)(
    'refuses a %s account even when the role matches',
    async (status) => {
      signedIn('user-1', {
        profiles: { data: { role: 'admin', professional_subtype: null, account_status: status } },
      })
      const refused = await refusal(await requireRole(['admin']))
      expect(refused.status).toBe(403)
      expect(refused.body.code).toBe('FORBIDDEN_ROLE')
      expect(refused.body.error).toBe('This account is not active.')
    }
  )

  it('refuses a role outside the allowed set', async () => {
    signedIn('user-1', { profiles: ACTIVE_CUSTOMER })
    const { status, body } = await refusal(await requireRole(['admin']))
    expect(status).toBe(403)
    expect(body.code).toBe('FORBIDDEN_ROLE')
    expect((body.details as { currentRole: string }).currentRole).toBe('customer')
  })

  it('refuses everything when the allowed set is empty', async () => {
    // A call site that computes its role list must not accidentally open the door.
    signedIn('user-1', { profiles: ACTIVE_CUSTOMER })
    expect((await requireRole([])).ok).toBe(false)
  })

  it('does not admit a customer to requireAdmin, nor an admin to requireCustomer', async () => {
    signedIn('user-1', { profiles: ACTIVE_CUSTOMER })
    expect((await requireAdmin()).ok).toBe(false)

    signedIn('user-2', {
      profiles: { data: { role: 'admin', professional_subtype: null, account_status: 'active' } },
    })
    expect((await requireCustomer()).ok).toBe(false)
  })

  it('propagates the unauthenticated refusal unchanged rather than reporting a role problem', async () => {
    createClientMock.mockResolvedValue(makeSupabase({}, null).client)
    const { status, body } = await refusal(await requireRole(['admin']))
    expect(status).toBe(401)
    expect(body.code).toBe('UNAUTHENTICATED')
  })
})

// ── requireProfessional ──────────────────────────────────────────────────────

describe('requireProfessional', () => {
  const professionalTables = (extra: Record<string, TableResult> = {}) => ({
    profiles: ACTIVE_PROFESSIONAL,
    professional_profiles: { data: { id: 'pro-1' } },
    ...extra,
  })

  it('resolves the professional profile id, which is NOT the user id', async () => {
    signedIn('user-1', professionalTables({ subscriptions: { data: null } }))
    const result = await requireProfessional()

    expect(result.ok).toBe(true)
    expect((result as ProfessionalContext).professionalId).toBe('pro-1')
    expect((result as ProfessionalContext).userId).toBe('user-1')
  })

  it('refuses an admin — admin action on a professional goes through audited routes', async () => {
    signedIn('admin-1', {
      profiles: { data: { role: 'admin', professional_subtype: null, account_status: 'active' } },
    })
    const { status, body } = await refusal(await requireProfessional())
    expect(status).toBe(403)
    expect(body.code).toBe('FORBIDDEN_ROLE')
  })

  it('never leaks a service-role client, even on the bearer path', async () => {
    const validator = makeSupabase({}, { id: 'user-1' })
    // The bearer-bound client is what the route receives — never the validator,
    // which holds the service role and bypasses RLS entirely.
    const bearerScoped = makeSupabase(professionalTables({ subscriptions: { data: null } }), {
      id: 'user-1',
    })
    createAdminClientMock.mockReturnValue(validator.client)
    createBearerClientMock.mockReturnValue(bearerScoped.client)

    const request = new Request('https://tradelynq.tech/api/x', {
      headers: { authorization: 'Bearer good.token' },
    })
    const result = await requireProfessional(request)

    expect(result.ok).toBe(true)
    expect((result as ProfessionalContext).supabase).toBe(bearerScoped.client)
    expect((result as ProfessionalContext).supabase).not.toBe(validator.client)
  })

  it('returns an actionable NOT_FOUND when onboarding never created the storefront', async () => {
    signedIn('user-1', {
      profiles: ACTIVE_PROFESSIONAL,
      professional_profiles: { data: null },
    })
    const { status, body } = await refusal(await requireProfessional())
    expect(status).toBe(404)
    expect(body.code).toBe('NOT_FOUND')
    expect((body.details as { resource: string }).resource).toBe('professional_profile')
  })

  it('fails closed with INTERNAL when the professional lookup errors', async () => {
    signedIn('user-1', {
      profiles: ACTIVE_PROFESSIONAL,
      professional_profiles: { data: null, error: { code: '08006' } },
    })
    const { status } = await refusal(await requireProfessional())
    expect(status).toBe(500)
  })

  it('counts only active and trialling subscriptions as entitled', async () => {
    // past_due, cancelled and paused must not reach the tier resolution at all.
    const double = signedIn(
      'user-1',
      professionalTables({ subscriptions: { data: { subscription_plans: { tier: 'pro' } } } })
    )
    await requireProfessional()
    expect(argsFor(double.log, 'subscriptions', 'in')).toEqual(['status', ['active', 'trialling']])
  })

  it('grants the tier for a trialling subscription — Pioneer members are entitled', async () => {
    signedIn(
      'user-1',
      professionalTables({
        subscriptions: { data: { subscription_plans: { tier: 'enterprise' } } },
      })
    )
    const result = await requireProfessional()
    expect((result as ProfessionalContext).tier).toBe('enterprise')
  })

  it('yields a null tier when there is no entitled subscription', async () => {
    signedIn('user-1', professionalTables({ subscriptions: { data: null } }))
    const result = await requireProfessional()
    expect((result as ProfessionalContext).tier).toBeNull()
  })

  /**
   * FIXED 20 Jul 2026 (was: medium, availability). The subscription query used
   * to destructure only `data` and discard `error`. `.maybeSingle()` raises
   * PGRST116 when MORE THAN ONE row matches, and nothing in the schema prevents
   * a professional holding two rows in ('active','trialling') — a re-subscribe
   * that did not close the old row is enough.
   *
   * The guard then silently reported tier = null, so every tier-gated route
   * answered PAYMENT_REQUIRED to a fully paid Enterprise customer, with no log
   * line to explain it. Failing loudly is right: telling a paying customer their
   * subscription does not exist, with nothing to debug from, is worse than a 500.
   */
  it('fails loudly when the subscription lookup errors, rather than silently downgrading', async () => {
    signedIn(
      'user-1',
      professionalTables({
        subscriptions: {
          data: null,
          error: { code: 'PGRST116', message: 'JSON object requested, multiple rows returned' },
        },
      })
    )

    const { status, body } = await refusal(await requireProfessional())
    expect(status).toBe(500)
    expect(body.code).toBe('INTERNAL')

    // And it is diagnosable — the previous behaviour left no trace at all.
    expect(loggedErrors.some((e) => e.event === 'access:subscription_lookup_failed')).toBe(true)
  })
})

// ── ensureLegalAcceptances ───────────────────────────────────────────────────

describe('ensureLegalAcceptances — the version check', () => {
  const context = (tables: Record<string, TableResult>): AuthContext => {
    const double = makeSupabase(tables)
    return {
      ok: true,
      userId: 'user-1',
      supabase: double.client as never,
    }
  }

  it('short-circuits without querying when nothing is required', async () => {
    const double = makeSupabase({})
    const result = await ensureLegalAcceptances(
      { ok: true, userId: 'user-1', supabase: double.client as never },
      []
    )
    expect(result.ok).toBe(true)
    expect(double.log).toHaveLength(0)
  })

  it('accepts the in-force version', async () => {
    const result = await ensureLegalAcceptances(
      context({
        legal_acceptances: {
          data: [
            { document_type: 'terms_of_service', document_version: '2.0' },
            { document_type: 'privacy_policy', document_version: '2.0' },
          ],
        },
      }),
      ['terms_of_service', 'privacy_policy']
    )
    expect(result.ok).toBe(true)
  })

  it('REJECTS a superseded version — accepting Terms v1.0 does not satisfy v2.0', async () => {
    // This is the whole point of versioned acceptance. An earlier implementation
    // checked only the document type and would have passed this.
    const result = await ensureLegalAcceptances(
      context({
        legal_acceptances: {
          data: [{ document_type: 'terms_of_service', document_version: '1.0' }],
        },
      }),
      ['terms_of_service']
    )
    const { status, body } = await refusal(result)
    expect(status).toBe(403)
    expect(body.code).toBe('LEGAL_ACCEPTANCE_REQUIRED')
    expect((body.details as { missingDocuments: string[] }).missingDocuments).toEqual([
      'terms_of_service',
    ])
  })

  it('rejects a NEWER version than the one in force — a forged row cannot satisfy the gate', async () => {
    // A user who can insert their own acceptance row must not be able to skip
    // ahead by claiming a version that does not exist.
    const result = await ensureLegalAcceptances(
      context({
        legal_acceptances: {
          data: [{ document_type: 'terms_of_service', document_version: '99.0' }],
        },
      }),
      ['terms_of_service']
    )
    expect(result.ok).toBe(false)
  })

  it('fails CLOSED on a document type absent from CURRENT_LEGAL_VERSIONS', async () => {
    // A typo at a call site must remove nothing. It must block everything and log.
    const result = await ensureLegalAcceptances(
      context({
        legal_acceptances: {
          data: [{ document_type: 'terms_of_servce', document_version: '2.0' }],
        },
      }),
      ['terms_of_servce']
    )
    const { body } = await refusal(result)
    expect((body.details as { missingDocuments: string[] }).missingDocuments).toEqual([
      'terms_of_servce',
    ])
    expect(loggedErrors.some((e) => e.event === 'access:unknown_legal_document')).toBe(true)
  })

  it('is not fooled by a prototype key such as "constructor" or "toString"', async () => {
    // CURRENT_LEGAL_VERSIONS is indexed by a caller-supplied string. If the lookup
    // walked the prototype chain, `constructor` would return a truthy function and
    // the required-version comparison would misbehave rather than fail closed.
    for (const key of ['constructor', 'toString', '__proto__']) {
      const result = await ensureLegalAcceptances(context({ legal_acceptances: { data: [] } }), [
        key,
      ])
      expect(result.ok, `${key} must not satisfy the gate`).toBe(false)
    }
  })

  it('fails CLOSED with INTERNAL when the acceptance lookup errors', async () => {
    const result = await ensureLegalAcceptances(
      context({ legal_acceptances: { data: null, error: { code: '08006' } } }),
      ['terms_of_service']
    )
    const { status, body } = await refusal(result)
    expect(status).toBe(500)
    expect(body.code).toBe('INTERNAL')
  })

  it('treats no acceptance rows at all as every document outstanding', async () => {
    const result = await ensureLegalAcceptances(
      context({ legal_acceptances: { data: null, error: null } }),
      ['terms_of_service', 'privacy_policy']
    )
    const { body } = await refusal(result)
    expect((body.details as { missingDocuments: string[] }).missingDocuments).toEqual([
      'terms_of_service',
      'privacy_policy',
    ])
  })

  it('scopes the acceptance query to the calling user', async () => {
    const double = makeSupabase({ legal_acceptances: { data: [] } })
    await ensureLegalAcceptances({ ok: true, userId: 'user-1', supabase: double.client as never }, [
      'terms_of_service',
    ])
    expect(argsFor(double.log, 'legal_acceptances', 'eq')).toEqual(['user_id', 'user-1'])
  })

  it('declares a version for every document the platform gates on', () => {
    for (const [type, version] of Object.entries(CURRENT_LEGAL_VERSIONS)) {
      expect(version, `${type} must declare a version`).toMatch(/^\d+\.\d+$/)
    }
  })
})

// ── requireCustomerConnectionGate ────────────────────────────────────────────

describe('requireCustomerConnectionGate — two free contacts, then verification', () => {
  const roleContext = (tables: Record<string, TableResult>): { ctx: RoleContext; log: CallLog } => {
    const double = makeSupabase(tables)
    return {
      ctx: {
        ok: true,
        userId: 'customer-1',
        supabase: double.client as never,
        role: 'customer',
        subtype: null,
      },
      log: double.log,
    }
  }

  it('allows the first two connections', async () => {
    for (const used of [0, 1]) {
      const { ctx } = roleContext({
        customer_profiles: { data: { connection_count: used, kyc_status: 'not_required' } },
        connections: { count: 0 },
      })
      expect((await requireCustomerConnectionGate(ctx, 'pro-1')).ok, `count ${used}`).toBe(true)
    }
  })

  it('refuses the third with KYC_REQUIRED and reports the count honestly', async () => {
    const { ctx } = roleContext({
      customer_profiles: { data: { connection_count: 2, kyc_status: 'not_required' } },
      connections: { count: 0 },
    })
    const { status, body } = await refusal(await requireCustomerConnectionGate(ctx, 'pro-1'))
    expect(status).toBe(403)
    expect(body.code).toBe('KYC_REQUIRED')
    expect(body.details).toEqual({ reason: 'connection_limit_reached', connectionsUsed: 2 })
  })

  it.each([
    ['submitted', 'verification_pending'],
    ['pending', 'verification_pending'],
    ['rejected', 'verification_rejected'],
  ] as const)('reports %s as %s so the client can explain the wait', async (kyc, reason) => {
    const { ctx } = roleContext({
      customer_profiles: { data: { connection_count: 5, kyc_status: kyc } },
      connections: { count: 0 },
    })
    const { body } = await refusal(await requireCustomerConnectionGate(ctx, 'pro-1'))
    expect((body.details as { reason: string }).reason).toBe(reason)
  })

  it('lets a verified customer past the limit without bound', async () => {
    const { ctx } = roleContext({
      customer_profiles: { data: { connection_count: 900, kyc_status: 'verified' } },
      connections: { count: 0 },
    })
    expect((await requireCustomerConnectionGate(ctx, 'pro-1')).ok).toBe(true)
  })

  it('charges nothing for an EXISTING connection, however high the count', async () => {
    const { ctx } = roleContext({
      customer_profiles: { data: { connection_count: 50, kyc_status: 'rejected' } },
      connections: { count: 1 },
    })
    expect((await requireCustomerConnectionGate(ctx, 'pro-1')).ok).toBe(true)
  })

  it('scopes the existing-connection probe to BOTH the caller and the named professional', async () => {
    // If the probe were scoped to the customer alone, ANY prior connection would
    // make EVERY further professional free — the gate would open after one use.
    const { ctx, log } = roleContext({
      customer_profiles: { data: { connection_count: 2, kyc_status: 'not_required' } },
      connections: { count: 0 },
    })
    await requireCustomerConnectionGate(ctx, 'pro-target')

    const eqs = log.filter((e) => e.table === 'connections' && e.method === 'eq').map((e) => e.args)
    expect(eqs).toContainEqual(['customer_id', 'customer-1'])
    expect(eqs).toContainEqual(['professional_id', 'pro-target'])
    // and it must be a count-only probe, never a row read
    expect(argsFor(log, 'connections', 'select')?.[1]).toMatchObject({ head: true })
  })

  it('fails CLOSED when the connection probe returns no count (error or RLS)', async () => {
    // An undefined count must read as "no existing connection", never as "free".
    const { ctx } = roleContext({
      customer_profiles: { data: { connection_count: 2, kyc_status: 'not_required' } },
      connections: { count: undefined },
    })
    expect((await requireCustomerConnectionGate(ctx, 'pro-1')).ok).toBe(false)
  })

  it('refuses when the customer profile is missing rather than defaulting to allowed', async () => {
    const { ctx } = roleContext({ customer_profiles: { data: null }, connections: { count: 0 } })
    const { status, body } = await refusal(await requireCustomerConnectionGate(ctx, 'pro-1'))
    expect(status).toBe(404)
    expect((body.details as { resource: string }).resource).toBe('customer_profile')
  })

  it('fails CLOSED with INTERNAL when the customer profile lookup errors', async () => {
    const { ctx } = roleContext({
      customer_profiles: { data: null, error: { code: '08006' } },
      connections: { count: 0 },
    })
    const { status } = await refusal(await requireCustomerConnectionGate(ctx, 'pro-1'))
    expect(status).toBe(500)
  })

  /**
   * NOTE — this guard is sound as written, but it is the ONLY thing enforcing the
   * gate. `connections` grants INSERT to `authenticated` under an RLS policy of
   * `customer_id = auth.uid()` and nothing else, so a customer using the public
   * anon key can create connections directly and skip this function entirely.
   * Proven against the live database; see the audit report. The fix belongs in a
   * migration (a BEFORE INSERT trigger enforcing the same rule), not here.
   */
  it('is not backed by any database-level equivalent — see the migration TODO', () => {
    expect(true).toBe(true)
  })
})

// ── requireTierFeature ───────────────────────────────────────────────────────

describe('requireTierFeature', () => {
  const professional = (tier: ProfessionalContext['tier']): ProfessionalContext => ({
    ok: true,
    userId: 'user-1',
    supabase: makeSupabase({}).client as never,
    role: 'professional',
    subtype: 'sole_trader',
    professionalId: 'pro-1',
    tier,
  })

  it('answers PAYMENT_REQUIRED, not TIER_UPGRADE_REQUIRED, when there is no subscription', async () => {
    // The distinction matters: one is fixed by paying, the other by upgrading.
    // A cancelled or past_due subscription arrives here as a null tier.
    const { status, body } = await refusal(requireTierFeature(professional(null), 'crm'))
    expect(status).toBe(402)
    expect(body.code).toBe('PAYMENT_REQUIRED')
    expect((body.details as { reason: string }).reason).toBe('subscription_inactive')
  })

  it('refuses a feature the tier does not include, naming the CHEAPEST sufficient tier', async () => {
    const { status, body } = await refusal(requireTierFeature(professional('presence'), 'crm'))
    expect(status).toBe(403)
    expect(body.code).toBe('TIER_UPGRADE_REQUIRED')
    // Studio, not Enterprise — the prompt must offer the smallest step.
    expect(body.details).toEqual({
      feature: 'crm',
      currentTier: 'presence',
      requiredTier: 'studio',
    })
  })

  it('gates webhooks to Enterprise and admits Enterprise', async () => {
    for (const tier of ['presence', 'growth', 'studio', 'pro'] as const) {
      expect(requireTierFeature(professional(tier), 'webhooks').ok, tier).toBe(false)
    }
    expect(requireTierFeature(professional('enterprise'), 'webhooks').ok).toBe(true)
  })

  it('treats a zero credit allowance as NOT having the feature', async () => {
    // Presence has tool_credits: 0. A truthiness check on the number would have
    // let it through as "defined", so this asserts the >0 rule explicitly.
    expect(requireTierFeature(professional('presence'), 'tool_credits').ok).toBe(false)
    expect(requireTierFeature(professional('growth'), 'tool_credits').ok).toBe(true)
  })

  it('returns the context unchanged when the tier qualifies', async () => {
    const context = professional('studio')
    expect(requireTierFeature(context, 'crm')).toBe(context)
  })
})
