import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath, ROLE_HOME, type Role } from '@/lib/routes'
import { logger } from '@/lib/utils/logger'

/**
 * GET /auth/callback — completes the OAuth (and email-confirmation) exchange.
 *
 * Supabase redirects here with a `code`, which is exchanged for a session. The
 * exchange must happen server-side: the code is single-use, and doing it in the
 * browser exposes it to any script on the page.
 *
 * Where the user lands:
 *   1. `?next=` if present and safe — someone who was sent to sign in resumes
 *      where they were going.
 *   2. `/auth/select-role` if their role is not yet confirmed.
 *   3. Their `ROLE_HOME`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl

  const code = searchParams.get('code')
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // The provider can redirect here with an error instead of a code — a user
  // declining consent is the common case, and is not worth a scary page.
  if (errorParam) {
    logger.warn('auth:oauth_provider_error', {
      error: errorParam,
      // Logged, never shown: provider descriptions are not user copy.
      description: errorDescription?.slice(0, 200),
    })
    return NextResponse.redirect(new URL('/login?error=oauth', origin))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=oauth', origin))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    logger.warn('auth:code_exchange_failed', { code: error?.code })
    return NextResponse.redirect(new URL('/login?error=oauth', origin))
  }

  // `next` is validated rather than trusted. Without this, an attacker sends
  // `/auth/callback?next=https://evil.example` and the victim is redirected
  // off-site immediately after authenticating.
  const requestedNext = searchParams.get('next')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, role_confirmed')
    .eq('id', data.user.id)
    .maybeSingle()

  // The profile is created by the handle_new_user trigger, so its absence here
  // means the trigger did not fire — worth knowing about, and the user still
  // needs somewhere to go.
  if (!profile) {
    logger.error('auth:profile_missing_after_signin', { userId: data.user.id })
    return NextResponse.redirect(new URL('/auth/select-role', origin))
  }

  if (!profile.role_confirmed) {
    // Role selection first. Preserving `next` through it means someone who
    // clicked "Contact" on a storefront still lands back there afterwards.
    const target = new URL('/auth/select-role', origin)
    const safeNext = requestedNext ? safeNextPath(requestedNext, '') : ''
    if (safeNext) target.searchParams.set('next', safeNext)
    return NextResponse.redirect(target)
  }

  const home = ROLE_HOME[profile.role as Role] ?? '/'
  return NextResponse.redirect(new URL(safeNextPath(requestedNext, home), origin))
}
