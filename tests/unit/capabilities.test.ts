/**
 * Admin capability matching (playbook S052).
 *
 * The playbook's note on this step is "property-tested — escalation bugs live
 * here", and these tests take that literally in the strongest available form.
 *
 * The capability taxonomy is a **closed set of 43 keys**, so this suite does not
 * sample the space — it enumerates it. Every property below is asserted against
 * every key, and against every grant derivable from every key. That is a
 * stronger guarantee than random property testing can give on a domain this
 * small: there is no unlucky seed and no uncovered corner.
 *
 * The questions asked are adversarial throughout. Not "does `queue.*` work" but
 * "what is the complete set of keys `queue.*` unlocks, and is anything in that
 * set a surprise".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { createClientMock, createAdminClientMock, createBearerClientMock, loggedWarnings } =
  vi.hoisted(() => ({
    createClientMock: vi.fn(),
    createAdminClientMock: vi.fn(),
    createBearerClientMock: vi.fn(),
    loggedWarnings: [] as Array<{ event: string; context?: Record<string, unknown> }>,
  }))

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))
vi.mock('@/lib/supabase/bearer', () => ({ createBearerClient: createBearerClientMock }))
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: (event: string, context?: Record<string, unknown>) =>
      loggedWarnings.push({ event, context }),
    error: () => {},
  },
}))

import {
  CAPABILITY_KEYS,
  GRANT_PRESETS,
  OWNER_ONLY_CAPABILITIES,
  matchesGrants,
  requireAdminCapability,
  type CapabilityKey,
} from '@/lib/access/capabilities'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Every proper prefix of a key, e.g. `queue.kyc.view` -> ['queue', 'queue.kyc']. */
function properPrefixes(key: string): string[] {
  const segments = key.split('.')
  const prefixes: string[] = []
  for (let length = 1; length < segments.length; length += 1) {
    prefixes.push(segments.slice(0, length).join('.'))
  }
  return prefixes
}

/** Every wildcard grant that SHOULD authorise a key: `queue.*`, `queue.kyc.*`, `queue.*.view`. */
function authorisingWildcards(key: string): string[] {
  const segments = key.split('.')
  const grants: string[] = []

  // Trailing wildcards at each depth.
  for (let length = 1; length < segments.length; length += 1) {
    grants.push([...segments.slice(0, length), '*'].join('.'))
  }
  // Interior wildcards, one segment at a time.
  for (let index = 0; index < segments.length - 1; index += 1) {
    const copy = [...segments]
    copy[index] = '*'
    grants.push(copy.join('.'))
  }

  return grants
}

describe('the taxonomy itself', () => {
  it('contains no duplicate keys', () => {
    expect(new Set(CAPABILITY_KEYS).size).toBe(CAPABILITY_KEYS.length)
  })

  it('uses only lowercase dot-paths of two or three segments', () => {
    for (const key of CAPABILITY_KEYS) {
      expect(key, `${key} is not a valid dot-path`).toMatch(/^[a-z0-9_]+(\.[a-z0-9_]+){1,2}$/)
    }
  })

  it('contains no wildcard — checks always name a concrete key', () => {
    // Wildcards are grant-side only (spec §1). A `*` in the taxonomy would mean
    // a route could check a pattern, which is the inverse of the design.
    for (const key of CAPABILITY_KEYS) {
      expect(key).not.toContain('*')
    }
  })

  it('lists every Owner-only capability as a real key', () => {
    for (const key of OWNER_ONLY_CAPABILITIES) {
      expect(CAPABILITY_KEYS, `${key} is Owner-only but not in the taxonomy`).toContain(key)
    }
  })

  it('never puts an Owner-only capability in a grant preset', () => {
    // A preset containing an E✗ key would be a trap: the grant API would accept
    // it, the UI would show it granted, and the check would refuse it forever.
    for (const [preset, grants] of Object.entries(GRANT_PRESETS)) {
      for (const key of OWNER_ONLY_CAPABILITIES) {
        expect(
          matchesGrants(key, grants),
          `preset '${preset}' authorises Owner-only capability '${key}'`
        ).toBe(false)
      }
    }
  })
})

describe('exact grants', () => {
  it('authorises exactly its own key, and nothing else — for all 43 keys', () => {
    for (const granted of CAPABILITY_KEYS) {
      for (const target of CAPABILITY_KEYS) {
        expect(matchesGrants(target, [granted]), `grant '${granted}' vs key '${target}'`).toBe(
          granted === target
        )
      }
    }
  })
})

describe('the prefix trap', () => {
  it('never authorises a key from a bare prefix — for all 43 keys', () => {
    // The single most likely escalation bug in a hand-rolled matcher. An
    // implementation using startsWith() turns a grant of `queue` into full
    // access to every queue capability including `queue.kyc.decide`.
    for (const key of CAPABILITY_KEYS) {
      for (const prefix of properPrefixes(key)) {
        expect(
          matchesGrants(key, [prefix]),
          `bare prefix '${prefix}' must not authorise '${key}'`
        ).toBe(false)
      }
    }
  })

  it('never authorises from a partial-segment wildcard', () => {
    // `*` is meaningful only as a whole segment. A matcher that does string
    // globbing would let `queue.app*` through to `queue.approvals.decide`.
    const partials = [
      ['queue.approvals.view', 'queue.app*'],
      ['queue.approvals.view', 'queue.approvals.vie*'],
      ['money.manual_payment', 'money.manual*'],
      ['rbac.grant', 'rbac.gra*'],
      ['platform.impersonate', 'platform.imp*'],
    ] as const

    for (const [key, grant] of partials) {
      expect(matchesGrants(key, [grant]), `'${grant}' must not authorise '${key}'`).toBe(false)
    }
  })
})

describe('the regex trap', () => {
  it('treats grants as data, never as patterns', () => {
    // If the matcher builds a RegExp from the grant, several of these authorise
    // EVERY capability on the platform. `.` is already a metacharacter in a
    // taxonomy built from dot-paths, which is what makes this so easy to get
    // wrong.
    const patternish = [
      '.*',
      '.+',
      '^.*$',
      '.*.*',
      'queue..*',
      '[a-z]*',
      '(.*)',
      '\\w+',
      'queue\\..*',
      '?',
      '**',
      '.*|rbac.grant',
    ]

    for (const key of CAPABILITY_KEYS) {
      for (const grant of patternish) {
        expect(
          matchesGrants(key, [grant]),
          `pattern-like grant '${grant}' authorised '${key}' — the matcher is interpreting grants`
        ).toBe(false)
      }
    }
  })
})

describe('wildcard semantics', () => {
  it('authorises a key from every wildcard form that covers it — for all 43 keys', () => {
    for (const key of CAPABILITY_KEYS) {
      for (const grant of authorisingWildcards(key)) {
        expect(matchesGrants(key, [grant]), `'${grant}' should authorise '${key}'`).toBe(true)
      }
    }
  })

  it('scopes a trailing wildcard to its own domain, exhaustively', () => {
    // Asserts the COMPLETE set `queue.*` unlocks, rather than spot-checking two
    // members of it. If a future key lands under `queue.` that should not be
    // covered by the ops-generalist preset, this test is where it surfaces.
    const domains = [
      'queue',
      'directory',
      'money',
      'ads',
      'analytics',
      'content',
      'platform',
      'rbac',
    ]

    for (const domain of domains) {
      for (const key of CAPABILITY_KEYS) {
        const shouldMatch = key.split('.')[0] === domain
        expect(matchesGrants(key, [`${domain}.*`]), `'${domain}.*' vs '${key}'`).toBe(shouldMatch)
      }
    }
  })

  it('makes an interior wildcard match exactly one segment', () => {
    // `queue.*.view` must not reach `.decide`. Getting this wrong hands a
    // read-only moderator the ability to approve listings.
    expect(matchesGrants('queue.kyc.view', ['queue.*.view'])).toBe(true)
    expect(matchesGrants('queue.approvals.view', ['queue.*.view'])).toBe(true)
    expect(matchesGrants('queue.kyc.decide', ['queue.*.view'])).toBe(false)
    expect(matchesGrants('queue.approvals.decide', ['queue.*.view'])).toBe(false)
  })

  it('does not let a trailing wildcard match zero segments', () => {
    // `queue.approvals.*` covers the actions under it, not the bare path.
    expect(matchesGrants('money.view', ['money.view.*'])).toBe(false)
  })

  it('does not let a wildcard cross a domain boundary', () => {
    expect(matchesGrants('rbac.grant', ['queue.*'])).toBe(false)
    expect(matchesGrants('money.export', ['analytics.*'])).toBe(false)
    expect(matchesGrants('platform.impersonate', ['platform.diagnostics.*'])).toBe(false)
  })

  it('lets a bare * authorise every key', () => {
    // Legal as a grant. It is NOT a way to obtain Owner-only capabilities —
    // requireAdminCapability refuses those for employees regardless. Asserted
    // in the check tests below.
    for (const key of CAPABILITY_KEYS) {
      expect(matchesGrants(key, ['*'])).toBe(true)
    }
  })
})

describe('malformed input fails closed', () => {
  it('refuses a key that is not in the taxonomy', () => {
    const bogus = [
      'queue.aprovals.decide', // typo
      'queue.kyc.approve', // action that does not exist
      'QUEUE.KYC.VIEW', // wrong case
      'queue.kyc.view ', // trailing space
      ' queue.kyc.view',
      '',
      'queue.kyc.view.extra',
      '*',
      'queue.*',
    ]

    for (const key of bogus) {
      expect(matchesGrants(key, ['*']), `bogus key '${key}' was authorised`).toBe(false)
    }
  })

  it('refuses when grants is not an array', () => {
    const notArrays = [null, undefined, 'queue.*', 42, {}, { grants: ['*'] }, true]
    for (const grants of notArrays) {
      expect(matchesGrants('queue.kyc.view', grants)).toBe(false)
    }
  })

  it('ignores non-string entries without throwing', () => {
    // grants is JSONB. A corrupted row must produce a denial, not a 500 — a
    // crash inside an authorisation check is an outage, not a safe default.
    expect(() => matchesGrants('queue.kyc.view', [null, 42, {}, []])).not.toThrow()
    expect(matchesGrants('queue.kyc.view', [null, 42, {}, []])).toBe(false)
    // A valid grant alongside corrupt entries still authorises.
    expect(matchesGrants('queue.kyc.view', [null, 'queue.kyc.view', 42])).toBe(true)
  })

  it('refuses an empty grants array', () => {
    for (const key of CAPABILITY_KEYS) {
      expect(matchesGrants(key, [])).toBe(false)
    }
  })
})

describe('the documented grant presets', () => {
  it('gives the moderation hire exactly what the matrix says', () => {
    const grants = GRANT_PRESETS.moderation
    expect(matchesGrants('queue.approvals.decide', grants)).toBe(true)
    expect(matchesGrants('queue.reviews.decide', grants)).toBe(true)
    expect(matchesGrants('directory.users.view', grants)).toBe(true)

    // The point of the profile: no money, no KYC documents, no RBAC.
    expect(matchesGrants('money.view', grants)).toBe(false)
    expect(matchesGrants('queue.kyc.view', grants)).toBe(false)
    expect(matchesGrants('directory.users.mutate', grants)).toBe(false)
    expect(matchesGrants('rbac.grant', grants)).toBe(false)
  })

  it('gives finance money but not moderation', () => {
    const grants = GRANT_PRESETS.finance
    expect(matchesGrants('money.manual_payment', grants)).toBe(true)
    expect(matchesGrants('analytics.account360.money', grants)).toBe(true)

    expect(matchesGrants('queue.approvals.decide', grants)).toBe(false)
    // Explicitly E✗ even for a finance profile.
    expect(matchesGrants('money.refund_request', grants)).toBe(false)
    expect(matchesGrants('money.export', grants)).toBe(false)
  })

  it('gives the ops generalist every queue but no money and no RBAC', () => {
    const grants = GRANT_PRESETS.ops_generalist
    for (const key of CAPABILITY_KEYS) {
      if (key.startsWith('queue.')) {
        expect(matchesGrants(key, grants), `ops should hold ${key}`).toBe(true)
      }
    }
    expect(matchesGrants('money.view', grants)).toBe(false)
    expect(matchesGrants('rbac.grant', grants)).toBe(false)
    expect(matchesGrants('platform.impersonate', grants)).toBe(false)
  })
})

// ── requireAdminCapability ───────────────────────────────────────────────────

type AdminRoleRow = { level: string; grants: unknown } | null

function mockAdmin(role: AdminRoleRow, profileRole: 'admin' | 'customer' = 'admin') {
  const client = {
    from: (table: string) => {
      const settled =
        table === 'admin_roles'
          ? { data: role, error: null }
          : {
              data: { role: profileRole, professional_subtype: null, account_status: 'active' },
              error: null,
            }

      const builder: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'order', 'limit']) {
        builder[method] = () => builder
      }
      builder.single = async () => settled
      builder.maybeSingle = async () => settled
      return builder
    },
    auth: {
      getUser: async () => ({ data: { user: { id: 'admin-1' } }, error: null }),
    },
  }

  createClientMock.mockResolvedValue(client)
  return client
}

async function statusOf(result: Awaited<ReturnType<typeof requireAdminCapability>>) {
  return result.ok ? 200 : result.response.status
}

describe('requireAdminCapability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loggedWarnings.length = 0
  })

  it('allows an owner everything, including Owner-only capabilities', () => {
    return (async () => {
      mockAdmin({ level: 'owner', grants: [] })
      for (const key of CAPABILITY_KEYS) {
        const result = await requireAdminCapability(key)
        expect(result.ok, `owner denied ${key}`).toBe(true)
      }
    })()
  })

  it('ignores the grants array entirely for an owner', async () => {
    // Spec §3: level='owner' implies `*`. An owner with an empty grants array
    // must not be locked out of their own platform.
    mockAdmin({ level: 'owner', grants: [] })
    const result = await requireAdminCapability('rbac.grant')
    expect(result.ok).toBe(true)
  })

  it('denies an admin with NO admin_roles row — every capability', async () => {
    // The counter-intuitive rule that makes adding an admin a two-step act.
    mockAdmin(null)
    for (const key of CAPABILITY_KEYS) {
      const result = await requireAdminCapability(key)
      expect(result.ok, `admin without a role row was allowed ${key}`).toBe(false)
      expect(await statusOf(result)).toBe(403)
    }
  })

  it('refuses an employee an Owner-only capability EVEN WHEN it is in their grants', async () => {
    // The escalation test that matters most. If the grant API is ever buggy, or
    // an owner pastes a preset containing an E✗ key, the check is the thing
    // standing between an employee and rbac.grant — which is the capability
    // that would let them grant themselves everything else.
    for (const key of OWNER_ONLY_CAPABILITIES) {
      mockAdmin({ level: 'employee', grants: [key] })
      const result = await requireAdminCapability(key)
      expect(result.ok, `employee obtained Owner-only ${key} via an explicit grant`).toBe(false)
      expect(await statusOf(result)).toBe(403)
    }
  })

  it('refuses an employee an Owner-only capability via a wildcard grant', async () => {
    // `*` and `rbac.*` are legal grants. Neither may yield an E✗ capability.
    for (const grants of [['*'], ['rbac.*'], ['platform.*'], ['money.*'], ['analytics.*']]) {
      for (const key of OWNER_ONLY_CAPABILITIES) {
        mockAdmin({ level: 'employee', grants })
        const result = await requireAdminCapability(key)
        expect(
          result.ok,
          `employee with grants ${JSON.stringify(grants)} obtained Owner-only ${key}`
        ).toBe(false)
      }
    }
  })

  it('logs loudly when an employee holds an Owner-only grant', async () => {
    // An E✗ key in a grants array means something upstream wrote a grant it
    // should have rejected. The denial is correct but the data is not, and a
    // silent denial would hide that.
    mockAdmin({ level: 'employee', grants: ['rbac.grant'] })
    await requireAdminCapability('rbac.grant')

    const warning = loggedWarnings.find(
      (entry) => entry.event === 'access:owner_only_capability_refused'
    )
    expect(warning).toBeDefined()
    expect(warning?.context?.grantedInError).toBe(true)
  })

  it('allows an employee a granted, non-Owner-only capability', async () => {
    mockAdmin({ level: 'employee', grants: ['queue.approvals.*'] })
    const result = await requireAdminCapability('queue.approvals.decide')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.adminLevel).toBe('employee')
  })

  it('denies an employee an ungranted capability — the acceptance test', async () => {
    // Playbook S052's stated verification: employee-without-grant denied.
    mockAdmin({ level: 'employee', grants: ['queue.approvals.*'] })
    const result = await requireAdminCapability('queue.kyc.decide')
    expect(result.ok).toBe(false)
    expect(await statusOf(result)).toBe(403)
  })

  it('carries actionable copy naming who can fix it', async () => {
    mockAdmin({ level: 'employee', grants: [] })
    const result = await requireAdminCapability('money.view')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')

    const body = (await result.response.json()) as { code: string; error: string }
    expect(body.code).toBe('FORBIDDEN_ROLE')
    expect(body.error).toBe("You don't have access to this — ask the owner to grant it.")
  })

  it('treats an unrecognised level as an employee, not an owner', async () => {
    // A corrupted or future `level` value must degrade to the LESS privileged
    // reading. Defaulting the other way would turn a typo into a superuser.
    mockAdmin({ level: 'Owner', grants: [] }) // wrong case
    const result = await requireAdminCapability('rbac.grant')
    expect(result.ok).toBe(false)
  })

  it('denies a non-admin before any capability logic runs', async () => {
    mockAdmin({ level: 'owner', grants: [] }, 'customer')
    const result = await requireAdminCapability('queue.approvals.view')
    expect(result.ok).toBe(false)
    expect(await statusOf(result)).toBe(403)
  })
})
