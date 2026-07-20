import 'server-only'
import type { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { err } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import {
  lowestTierWith,
  tierHasFeature,
  type FeatureKey,
  type TierId,
} from '@/lib/constants/pricing'
import type { Database } from '@/types/database'

/**
 * The access layer (playbook S051, spec master/06 §6.3).
 *
 * Every API route on this platform starts here. The contract is a discriminated
 * union — `{ ok: true, … }` or `{ ok: false, response }` — so a route reads:
 *
 * ```ts
 * const access = await requireProfessional()
 * if (!access.ok) return access.response
 * // access.userId and access.supabase are now non-null, proven by the compiler
 * ```
 *
 * ## Why a union rather than throwing
 *
 * A thrown error has to be caught somewhere, and the somewhere is usually a
 * generic handler that returns 500. That loses the distinction between "you are
 * not signed in" and "the database is down" — the first is a redirect to login,
 * the second is an incident. Returning the response makes the guard's outcome
 * part of the route's normal control flow, and the compiler enforces that the
 * caller handles it before touching `userId`.
 *
 * ## Bearer tokens alongside cookies (D21)
 *
 * The mobile apps authenticate with `Authorization: Bearer <jwt>`, the web with
 * cookies. Both resolve here, in one code path — which is the entire point.
 * V1's apps talked to Supabase directly and therefore bypassed every business
 * rule in this file: the connection gate, tier gates, and caps simply did not
 * exist for mobile users. One rules layer, two transports.
 */

// ── Result types ─────────────────────────────────────────────────────────────

type Failure = { ok: false; response: NextResponse }

export type AuthContext = {
  ok: true
  userId: string
  /** RLS-scoped client bound to this caller. Use it for all reads and writes. */
  supabase: SupabaseClient<Database>
}

export type RoleContext = AuthContext & {
  role: 'customer' | 'professional' | 'admin'
  subtype: 'student_entrepreneur' | 'sole_trader' | 'registered_business' | null
}

export type ProfessionalContext = RoleContext & {
  /** The professional_profiles row id. Distinct from userId. */
  professionalId: string
  tier: TierId | null
}

export type AccessResult<T> = T | Failure

// ── Session resolution ───────────────────────────────────────────────────────

/**
 * Resolves the caller from either transport.
 *
 * A bearer token is verified by Supabase, not decoded locally: a JWT's payload
 * is readable by anyone holding it, and only the auth server can say whether
 * the signature is valid and the session still live.
 */
async function resolveUser(
  request?: Request
): Promise<{ userId: string; supabase: SupabaseClient<Database> } | null> {
  const bearer = request?.headers.get('authorization')

  if (bearer?.startsWith('Bearer ')) {
    const token = bearer.slice(7).trim()
    if (!token) return null

    // The admin client is used ONLY to validate the token. The client returned
    // to the caller is the RLS-scoped one below — a route must never receive a
    // service-role client just because it authenticated by bearer.
    const validator = createAdminClient()
    const { data, error } = await validator.auth.getUser(token)

    if (error || !data.user) return null

    const supabase = await createClient()
    return { userId: data.user.id, supabase }
  }

  const supabase = await createClient()
  // getUser() revalidates against the auth server. getSession() reads the cookie
  // and trusts it, which is forgeable — never use it for authorisation.
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) return null
  return { userId: data.user.id, supabase }
}

// ── Guards ───────────────────────────────────────────────────────────────────

/** A valid session, of any role. */
export async function requireAuth(request?: Request): Promise<AccessResult<AuthContext>> {
  const resolved = await resolveUser(request)

  if (!resolved) {
    return { ok: false, response: err('UNAUTHENTICATED') }
  }

  return { ok: true, userId: resolved.userId, supabase: resolved.supabase }
}

/**
 * A valid session whose role is in the allowed set.
 *
 * Reads the role from the database rather than the JWT. Role changes must take
 * effect immediately — a suspended admin holding an unexpired token must not
 * keep admin powers until it lapses.
 */
export async function requireRole(
  allowed: ReadonlyArray<'customer' | 'professional' | 'admin'>,
  request?: Request
): Promise<AccessResult<RoleContext>> {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth

  const { data, error } = await auth.supabase
    .from('profiles')
    .select('role, professional_subtype, account_status')
    .eq('id', auth.userId)
    .single()

  if (error || !data) {
    logger.error('access:profile_lookup_failed', { userId: auth.userId, code: error?.code })
    return { ok: false, response: err('INTERNAL') }
  }

  // A suspended account is refused before role is even considered.
  if (data.account_status !== 'active') {
    return {
      ok: false,
      response: err(
        'FORBIDDEN_ROLE',
        { requiredRoles: allowed, currentRole: data.role },
        'This account is not active.'
      ),
    }
  }

  if (!allowed.includes(data.role)) {
    return {
      ok: false,
      response: err('FORBIDDEN_ROLE', { requiredRoles: allowed, currentRole: data.role }),
    }
  }

  return {
    ...auth,
    role: data.role,
    subtype: data.professional_subtype,
  }
}

export async function requireCustomer(request?: Request): Promise<AccessResult<RoleContext>> {
  return requireRole(['customer'], request)
}

export async function requireAdmin(request?: Request): Promise<AccessResult<RoleContext>> {
  return requireRole(['admin'], request)
}

/**
 * A professional, with their profile id and tier resolved.
 *
 * Admins are NOT admitted here. An admin acting on a professional's behalf goes
 * through the admin routes, which audit the action — a shared guard would make
 * those actions indistinguishable from the professional's own in the log.
 */
export async function requireProfessional(
  request?: Request
): Promise<AccessResult<ProfessionalContext>> {
  const role = await requireRole(['professional'], request)
  if (!role.ok) return role

  const { data, error } = await role.supabase
    .from('professional_profiles')
    .select('id')
    .eq('user_id', role.userId)
    .maybeSingle()

  if (error) {
    logger.error('access:professional_lookup_failed', { userId: role.userId, code: error.code })
    return { ok: false, response: err('INTERNAL') }
  }

  if (!data) {
    // Authenticated as a professional but onboarding never created the profile.
    // A distinct, actionable answer rather than a generic 403.
    return {
      ok: false,
      response: err(
        'NOT_FOUND',
        { resource: 'professional_profile' },
        'Finish setting up your storefront to continue.'
      ),
    }
  }

  // The tier lives on subscription_plans, not on the subscription — the
  // subscription points at a plan. Joined here so callers get the tier directly
  // and no route has to know the shape of that relationship.
  //
  // 'trialling' counts as entitled: Pioneer members are on a real plan with real
  // access, and gating them out of the features they were given for free would
  // defeat the programme.
  const { data: subscription } = await role.supabase
    .from('subscriptions')
    .select('subscription_plans(tier)')
    .eq('professional_id', data.id)
    .in('status', ['active', 'trialling'])
    .maybeSingle()

  const plan = subscription?.subscription_plans as { tier: TierId } | null | undefined

  return {
    ...role,
    professionalId: data.id,
    tier: plan?.tier ?? null,
  }
}

// ── Gates ────────────────────────────────────────────────────────────────────

/**
 * The document versions currently in force.
 *
 * Bumping a version here is what re-prompts every user — which is the whole
 * point of versioned acceptance, and only works because acceptance is checked
 * against the CURRENT version rather than against "have they ever accepted this
 * document". An earlier version of this function checked only the document
 * type, which would have let someone who accepted Terms v1.0 sail past a v2.0
 * that materially changed their obligations.
 *
 * Keep in step with the published documents. A version here with no
 * corresponding published document blocks every gated action on the platform.
 */
export const CURRENT_LEGAL_VERSIONS: Readonly<Record<string, string>> = {
  terms_of_service: '2.0',
  privacy_policy: '2.0',
  acceptable_use: '1.0',
  professional_agreement: '1.0',
} as const

/**
 * Requires that the in-force version of each named document has been accepted.
 *
 * Returns the missing document types so the client can render the acceptance
 * modal inline rather than dead-ending the user.
 */
export async function ensureLegalAcceptances(
  context: AuthContext,
  requiredDocuments: readonly string[]
): Promise<AccessResult<AuthContext>> {
  if (requiredDocuments.length === 0) return context

  const { data, error } = await context.supabase
    .from('legal_acceptances')
    .select('document_type, document_version')
    .eq('user_id', context.userId)
    .in('document_type', [...requiredDocuments])

  if (error) {
    logger.error('access:legal_lookup_failed', { userId: context.userId, code: error.code })
    return { ok: false, response: err('INTERNAL') }
  }

  // Keyed by "type@version" so accepting an OLD version does not satisfy a new
  // requirement.
  const accepted = new Set(
    (data ?? []).map((row) => `${row.document_type}@${row.document_version}`)
  )

  const missing = requiredDocuments.filter((type) => {
    const required = CURRENT_LEGAL_VERSIONS[type]
    if (!required) {
      // An unknown document cannot be satisfied, so it must fail closed rather
      // than be silently skipped — a typo in a call site would otherwise remove
      // a legal gate without anyone noticing.
      logger.error('access:unknown_legal_document', { documentType: type })
      return true
    }
    return !accepted.has(`${type}@${required}`)
  })

  if (missing.length > 0) {
    return { ok: false, response: err('LEGAL_ACCEPTANCE_REQUIRED', { missingDocuments: missing }) }
  }

  return context
}

/**
 * The connection gate: two free professional contacts, then identity verification.
 *
 * The count is read from the database, never from the client. It is maintained
 * by trigger and guarded against self-editing at the column level — three layers
 * for one number, because that number is the entire gate.
 */
export async function requireCustomerConnectionGate(
  context: RoleContext,
  professionalId: string
): Promise<AccessResult<RoleContext>> {
  const { data: profile, error } = await context.supabase
    .from('customer_profiles')
    .select('connection_count, kyc_status')
    .eq('user_id', context.userId)
    .maybeSingle()

  if (error) {
    logger.error('access:customer_profile_failed', { userId: context.userId, code: error.code })
    return { ok: false, response: err('INTERNAL') }
  }

  if (!profile) {
    return {
      ok: false,
      response: err('NOT_FOUND', { resource: 'customer_profile' }),
    }
  }

  // An existing connection to THIS professional is free and always was —
  // otherwise the gate would charge a customer twice for one relationship.
  const { count } = await context.supabase
    .from('connections')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', context.userId)
    .eq('professional_id', professionalId)

  if ((count ?? 0) > 0) return context

  const FREE_CONNECTIONS = 2

  if (profile.connection_count >= FREE_CONNECTIONS && profile.kyc_status !== 'verified') {
    return {
      ok: false,
      response: err('KYC_REQUIRED', {
        reason:
          profile.kyc_status === 'rejected'
            ? 'verification_rejected'
            : profile.kyc_status === 'submitted' || profile.kyc_status === 'pending'
              ? 'verification_pending'
              : 'connection_limit_reached',
        connectionsUsed: profile.connection_count,
      }),
    }
  }

  return context
}

/**
 * Requires that the professional's tier includes a feature.
 *
 * Names the CHEAPEST tier that unlocks it, so the upgrade prompt offers the
 * smallest sufficient step rather than pushing everyone to Enterprise.
 */
export function requireTierFeature(
  context: ProfessionalContext,
  feature: FeatureKey
): AccessResult<ProfessionalContext> {
  // No active subscription is a payment problem, not a tier problem, and the
  // fix is different — so the code is different.
  if (!context.tier) {
    return {
      ok: false,
      response: err('PAYMENT_REQUIRED', { reason: 'subscription_inactive' }),
    }
  }

  if (!tierHasFeature(context.tier, feature)) {
    return {
      ok: false,
      response: err('TIER_UPGRADE_REQUIRED', {
        feature,
        currentTier: context.tier,
        requiredTier: lowestTierWith(feature),
      }),
    }
  }

  return context
}
