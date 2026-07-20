import { z } from 'zod'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { requireAuth } from '@/lib/access/api'
import { createAdminClient } from '@/lib/supabase/admin'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import { ROLE_HOME, type Role } from '@/lib/routes'

/**
 * POST /api/auth/assign-role
 *
 * Sets the caller's role and, for professionals, their subtype. Also the only
 * path by which a role is ever CHANGED, under the grace-period rules.
 *
 * ## Why this needs the admin client
 *
 * `profiles.role` is protected by a column guard that refuses any change made by
 * a normal session — that guard is what stops a user PATCHing themselves to
 * admin. This route is the single sanctioned exception, so it uses the service
 * role, which the guard bypasses on `auth.uid() IS NULL`.
 *
 * That makes this route's own checks the ONLY thing standing between a user and
 * an arbitrary role. Hence: the role is validated against a closed list that
 * does not contain `admin`, and every write is scoped to the caller's own id.
 * Admin is granted by an owner through the admin console, never here.
 *
 * ## Grace period
 *
 * 72 hours, at most 2 changes. The window exists because people genuinely pick
 * wrong on the way in; the cap exists because a role flip rewrites which tables
 * a user owns, and unlimited flips make support unanswerable.
 */

const GRACE_PERIOD_HOURS = 72
const MAX_ROLE_CHANGES = 2

const schema = z.object({
  // `admin` is deliberately absent. Adding it here would make privilege
  // escalation a one-line request.
  role: z.enum(['customer', 'professional']),
  subtype: z.enum(['student_entrepreneur', 'sole_trader', 'registered_business']).optional(),
})

export async function POST(request: Request) {
  // 1. Rate limit. `auth` is a fail-closed limiter: if the limit cannot be
  //    verified this refuses, because unlimited attempts here are an attack.
  const limit = await checkRateLimit('auth', identifierFrom(request))
  if (!limit.ok) return limit.response

  // 2. Auth
  const access = await requireAuth(request)
  if (!access.ok) return access.response

  // 3. Validate
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return err('INVALID_INPUT', { fieldErrors: {}, formErrors: ['Expected a JSON body.'] })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return err('INVALID_INPUT', parsed.error.flatten())
  }

  const { role, subtype } = parsed.data

  // A professional must declare a subtype; nobody else may have one. The
  // database enforces this too — checking here produces an actionable 422
  // instead of an opaque 500 from a constraint violation.
  if (role === 'professional' && !subtype) {
    return err('INVALID_INPUT', {
      fieldErrors: { subtype: ['Choose the option that best describes you.'] },
      formErrors: [],
    })
  }
  if (role === 'customer' && subtype) {
    return err('INVALID_INPUT', {
      fieldErrors: { subtype: ['Customers do not have a professional subtype.'] },
      formErrors: [],
    })
  }

  // 4. Read current state through the CALLER's client, so RLS confirms they can
  //    only ever see their own row.
  const { data: profile, error: readError } = await access.supabase
    .from('profiles')
    .select('role, role_confirmed, role_selected_at, role_change_count, account_status')
    .eq('id', access.userId)
    .single()

  if (readError || !profile) {
    logger.error('assign_role:profile_read_failed', {
      userId: access.userId,
      code: readError?.code,
    })
    return err('INTERNAL')
  }

  if (profile.account_status !== 'active') {
    return err(
      'FORBIDDEN_ROLE',
      { requiredRoles: ['customer', 'professional'], currentRole: profile.role },
      'This account is not active.'
    )
  }

  const isFirstSelection = !profile.role_confirmed

  // ── Grace-period rules, for a CHANGE rather than a first selection ────────
  if (!isFirstSelection) {
    if (profile.role === role) {
      // Already this role. Idempotent success rather than an error — a
      // double-submitted form should not read as a failure.
      return ok({ role, redirectTo: ROLE_HOME[role] })
    }

    if (profile.role_change_count >= MAX_ROLE_CHANGES) {
      return err(
        'CONFLICT_STATE',
        {
          resource: 'profile.role',
          currentState: `changed_${profile.role_change_count}_times`,
          attemptedTransition: role,
        },
        'You have already changed your account type twice. Message us on WhatsApp and we can help.'
      )
    }

    const selectedAt = profile.role_selected_at ? new Date(profile.role_selected_at) : null
    const hoursElapsed = selectedAt
      ? (Date.now() - selectedAt.getTime()) / (1000 * 60 * 60)
      : Number.POSITIVE_INFINITY

    if (hoursElapsed > GRACE_PERIOD_HOURS) {
      return err(
        'CONFLICT_STATE',
        {
          resource: 'profile.role',
          currentState: 'grace_period_expired',
          attemptedTransition: role,
        },
        'The 72-hour window to change your account type has closed. Message us on WhatsApp and we can help.'
      )
    }

    // A professional with work in flight cannot walk away from it by switching
    // role — the enquiries would be orphaned and the customers left waiting.
    if (profile.role === 'professional') {
      const { count } = await access.supabase
        .from('job_enquiries')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'accepted', 'in_progress'])

      if ((count ?? 0) > 0) {
        return err(
          'CONFLICT_STATE',
          {
            resource: 'profile.role',
            currentState: 'has_active_enquiries',
            attemptedTransition: role,
          },
          'Finish or decline your active enquiries before changing your account type.'
        )
      }
    }
  }

  // 5. Write. The admin client is required because the column guard on
  //    profiles.role refuses session-made changes — see the note at the top.
  const admin = createAdminClient()

  const { error: writeError } = await admin
    .from('profiles')
    .update({
      role,
      professional_subtype: role === 'professional' ? subtype! : null,
      role_confirmed: true,
      role_selected_at: new Date().toISOString(),
      role_change_count: isFirstSelection ? 0 : profile.role_change_count + 1,
    })
    // Scoped to the caller. Belt and braces with the checks above: even a bug in
    // the logic cannot write another user's row.
    .eq('id', access.userId)

  if (writeError) {
    logger.error('assign_role:write_failed', { userId: access.userId, code: writeError.code })
    return err('INTERNAL')
  }

  logger.info('assign_role:assigned', {
    userId: access.userId,
    role,
    subtype: subtype ?? null,
    isFirstSelection,
  })

  return ok({ role, subtype: subtype ?? null, redirectTo: ROLE_HOME[role as Role] })
}
