/**
 * Admin capability keys and grant matching (playbook S052,
 * spec `details/admin-permissions.md` §§1–4).
 *
 * `profiles.role = 'admin'` is the coarse gate. This file is the fine one: it
 * decides which of the ~30 administrative capabilities a given admin actually
 * holds. The playbook's note on this step is blunt and correct — **escalation
 * bugs live here** — so the whole module is built around three ideas.
 *
 * ## 1. The matcher never builds a regular expression
 *
 * The obvious implementation of `queue.*` is to turn the grant into a RegExp.
 * That is also the vulnerability: capability keys are dot-paths, `.` is a regex
 * metacharacter, and a grant of `.*` compiles to a pattern matching every key on
 * the platform. A grants array is data — it arrives from a database column that
 * an API writes — so treating it as a pattern language is treating data as code.
 *
 * Matching here is segment-wise string comparison. There is no `RegExp`, no
 * `startsWith`, and no `includes` anywhere in this file, because each of those
 * matches across the `.` boundaries that give the taxonomy its meaning:
 * `startsWith('queue')` would let a grant of `queue` reach `queue.kyc.decide`,
 * and a grant of `money.view` reach `money.view_and_export` if such a key were
 * ever added.
 *
 * ## 2. Seven capabilities can never be held by an employee
 *
 * The matrix marks them **E✗** — Owner-only, not merely default-off. Checking
 * the grants array alone would make that a policy the grant API is trusted to
 * uphold, and a single bug there (or one careless preset) would silently hand an
 * employee the ability to grant themselves everything else. So the Owner-only
 * set is enforced *at the check*, and an employee is refused even when the key
 * is sitting in their grants array. Defence in depth for the one boundary whose
 * failure compromises every other boundary.
 *
 * ## 3. Everything unknown fails closed
 *
 * A malformed key, a grant that is not a string, an admin with no `admin_roles`
 * row: all denied. The spec is explicit that an admin without a row has **zero**
 * capabilities, which is the opposite of the intuitive "admin means allowed".
 */

import { err } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import { requireAdmin, type AccessResult, type RoleContext } from './api'

// ── The taxonomy ─────────────────────────────────────────────────────────────

/**
 * Every capability key, spelled out (spec §1).
 *
 * Enumerated rather than pattern-generated so a check against a key that does
 * not exist is a **compile error**, not a silent denial at runtime. A typo in
 * `requireAdminCapability('queue.aprovals.decide')` should stop the build, not
 * quietly lock an admin out of a queue and look like a permissions bug.
 */
export const CAPABILITY_KEYS = [
  // Queues
  'queue.approvals.view',
  'queue.approvals.decide',
  'queue.verification.view',
  'queue.verification.decide',
  'queue.kyc.view',
  'queue.kyc.decide',
  'queue.youth.view',
  'queue.youth.decide',
  'queue.reviews.view',
  'queue.reviews.decide',
  'queue.disputes.view',
  'queue.disputes.decide',
  'queue.registration.view',
  'queue.registration.decide',
  'queue.orders.view',
  'queue.orders.decide',

  // Directory
  'directory.users.view',
  'directory.users.mutate',
  'directory.professionals.view',
  'directory.professionals.mutate',
  'directory.customers.view',
  'directory.customers.mutate',

  // Money
  'money.view',
  'money.manual_payment',
  'money.subscription_override',
  'money.refund_request',
  'money.export',

  // Ads
  'ads.view',
  'ads.manage',
  'ads.review',

  // Analytics
  'analytics.platform.view',
  'analytics.account360.view',
  'analytics.account360.money',
  'analytics.export',

  // Content
  'content.categories.manage',
  'content.templates.manage',
  'content.legal.versions',

  // Platform
  'platform.diagnostics.view',
  'platform.flags.manage',
  'platform.impersonate',

  // RBAC
  'rbac.view',
  'rbac.grant',
] as const

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number]

const CAPABILITY_KEY_SET: ReadonlySet<string> = new Set(CAPABILITY_KEYS)

/**
 * The **E✗** set: Owner-only, never grantable to an employee (spec §2).
 *
 * Each entry is here because holding it lets someone either escalate their own
 * privileges or move money or data off the platform irreversibly:
 *
 *   - `rbac.grant`         — grant yourself every other capability
 *   - `platform.impersonate` — act as any user, including an owner
 *   - `platform.flags.manage` — disable the kill-switches and notification gates
 *   - `content.legal.versions` — publish a legal document everyone is re-prompted to accept
 *   - `money.refund_request` — move money out
 *   - `money.export` / `analytics.export` — bulk personal data leaves the platform
 */
export const OWNER_ONLY_CAPABILITIES: ReadonlySet<CapabilityKey> = new Set([
  'rbac.grant',
  'platform.impersonate',
  'platform.flags.manage',
  'content.legal.versions',
  'money.refund_request',
  'money.export',
  'analytics.export',
])

/** Seedable grant profiles (spec §3). Kept beside the taxonomy so a preset cannot name a key that does not exist. */
export const GRANT_PRESETS: Readonly<Record<string, readonly string[]>> = {
  moderation: [
    'queue.approvals.*',
    'queue.reviews.*',
    'queue.orders.*',
    'directory.users.view',
    'analytics.account360.view',
  ],
  ops_generalist: [
    'queue.*',
    'directory.users.view',
    'directory.users.mutate',
    'ads.view',
    'analytics.platform.view',
    'analytics.account360.view',
  ],
  finance: [
    'money.view',
    'money.manual_payment',
    'money.subscription_override',
    'analytics.account360.view',
    'analytics.account360.money',
    'analytics.platform.view',
    'directory.users.view',
  ],
}

// ── The matcher ──────────────────────────────────────────────────────────────

const WILDCARD = '*'

/**
 * Does any grant in `grants` authorise the concrete capability `key`?
 *
 * Wildcards are **grant-side only** (spec §1): a check always names a concrete
 * key, and only the stored grant may contain `*`. A `*` appearing in `key` is
 * therefore not a wildcard — it is a malformed key, and is refused.
 *
 * Segment semantics:
 *
 *   - `*` in a non-final position matches **exactly one** segment.
 *       `queue.*.view` authorises `queue.kyc.view` but not `queue.kyc.decide`.
 *   - `*` in the final position matches **one or more** remaining segments.
 *       `queue.*` authorises `queue.kyc.view`; `money.*` authorises `money.view`.
 *   - Anything else must match its segment exactly, case-sensitively.
 *
 * Deliberately NOT matched:
 *
 *   - `queue` does not authorise `queue.kyc.view` — a prefix without a wildcard
 *     is not a wildcard. This is the single most likely escalation bug in a
 *     hand-rolled matcher and the reason `startsWith` appears nowhere here.
 *   - `queue.app*` does not authorise `queue.approvals.view` — partial-segment
 *     wildcards are not a thing; `*` is only meaningful as a whole segment.
 *   - A final `*` matches one or more segments, never zero, so
 *     `queue.approvals.*` does not authorise the bare path `queue.approvals`.
 */
export function matchesGrants(key: string, grants: unknown): boolean {
  // Fail closed on anything that is not a known concrete key. This also rejects
  // a key containing `*`, since no entry in the taxonomy contains one.
  if (!CAPABILITY_KEY_SET.has(key)) return false
  if (!Array.isArray(grants)) return false

  const keySegments = key.split('.')

  for (const grant of grants) {
    // A grants array is JSONB from the database. A non-string entry is not a
    // grant that failed to match; it is a corrupted row, and it must not throw
    // either — a crash in an authorisation check is an outage, not a denial.
    if (typeof grant !== 'string' || grant.length === 0) continue
    if (grantAuthorises(grant.split('.'), keySegments)) return true
  }

  return false
}

function grantAuthorises(
  grantSegments: readonly string[],
  keySegments: readonly string[]
): boolean {
  // More segments in the grant than in the key can never match: every grant
  // segment must consume at least one key segment.
  if (grantSegments.length > keySegments.length) return false

  for (let index = 0; index < grantSegments.length; index += 1) {
    const grantSegment = grantSegments[index]
    const keySegment = keySegments[index]

    if (grantSegment === undefined || keySegment === undefined) return false

    const isFinalGrantSegment = index === grantSegments.length - 1

    if (grantSegment === WILDCARD) {
      // A trailing wildcard absorbs the rest of the key. Because the length
      // check above guarantees at least one segment remains, this can never
      // match zero segments.
      if (isFinalGrantSegment) return true
      continue
    }

    if (grantSegment !== keySegment) return false
  }

  // Every grant segment matched exactly, and no wildcard absorbed a tail — so
  // this is only an authorisation if the grant covered the WHOLE key. A grant
  // of `queue` against `queue.kyc.view` lands here with segments left over.
  return grantSegments.length === keySegments.length
}

// ── The check ────────────────────────────────────────────────────────────────

export type AdminCapabilityContext = RoleContext & {
  capability: CapabilityKey
  adminLevel: 'owner' | 'employee'
}

/** Copy from the spec: actionable, and names who can fix it. */
const FORBIDDEN_MESSAGE = "You don't have access to this — ask the owner to grant it."

/**
 * Gates an admin route on one concrete capability (spec §4).
 *
 * Replaces a bare `requireAdmin()` at every admin route. The order matters:
 * session, then admin role, then the `admin_roles` row, then owner short-circuit,
 * then the Owner-only guard, then the grants array.
 *
 * The Owner-only guard sits **before** the grants check on purpose. Reading the
 * grants first and the guard second would still be correct today, but it would
 * mean the code's shape implies "grants decide, with an exception" when the
 * actual rule is "these are never delegable, full stop".
 */
export async function requireAdminCapability(
  key: CapabilityKey,
  request?: Request
): Promise<AccessResult<AdminCapabilityContext>> {
  const base = await requireAdmin(request)
  if (!base.ok) return base

  const { data, error } = await base.supabase
    .from('admin_roles')
    .select('level, grants')
    .eq('user_id', base.userId)
    .maybeSingle()

  if (error) {
    logger.error('access:admin_role_lookup_failed', { userId: base.userId, code: error.code })
    return { ok: false, response: err('INTERNAL') }
  }

  // Spec §3: an admin WITHOUT an admin_roles row has zero capabilities. This is
  // the opposite of the intuitive reading, and it is what makes adding an admin
  // a two-step act — the coarse role alone grants nothing.
  if (!data) {
    logger.warn('access:admin_without_role_row', { userId: base.userId, capability: key })
    return { ok: false, response: forbidden(key, null) }
  }

  const level = data.level === 'owner' ? 'owner' : 'employee'

  if (level === 'owner') {
    return { ...base, capability: key, adminLevel: 'owner' }
  }

  // The E✗ set. Refused even if the key is present in the grants array — the
  // grants column is data written by an API, and this check is what stops a bug
  // there from becoming privilege escalation.
  if (OWNER_ONLY_CAPABILITIES.has(key)) {
    logger.warn('access:owner_only_capability_refused', {
      userId: base.userId,
      capability: key,
      // Logged loudly: an employee whose grants contain an Owner-only key means
      // something upstream wrote a grant it should have rejected.
      grantedInError: matchesGrants(key, data.grants),
    })
    return { ok: false, response: forbidden(key, 'employee') }
  }

  if (!matchesGrants(key, data.grants)) {
    return { ok: false, response: forbidden(key, 'employee') }
  }

  return { ...base, capability: key, adminLevel: 'employee' }
}

function forbidden(key: CapabilityKey, level: 'owner' | 'employee' | null) {
  return err(
    'FORBIDDEN_ROLE',
    // `requiredRoles` carries the capability rather than a role name: the
    // taxonomy's whole point is that "admin" is not the answer to "what does
    // this route need".
    {
      requiredRoles: [key],
      currentRole: level === null ? 'admin (no role row)' : `admin:${level}`,
    },
    FORBIDDEN_MESSAGE
  )
}
