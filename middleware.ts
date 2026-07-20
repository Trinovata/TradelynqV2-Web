import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  ROLE_HOME,
  isAlwaysOpen,
  isAuthPath,
  isPublicPath,
  namespaceOwner,
  loginRedirect,
  safeNextPath,
  type Role,
} from '@/lib/routes'

/**
 * Middleware (playbook S050).
 *
 * Three jobs, in order:
 *
 *   1. Hide `/dev/*` in production.
 *   2. Refresh the Supabase session on every request, so a token nearing expiry
 *      is renewed before a Server Component tries to use it.
 *   3. Route by role namespace — send signed-out users to login, and users in
 *      the wrong namespace to their own home.
 *
 * ## What middleware is NOT
 *
 * **It is not the security boundary.** It runs at the edge, before any route
 * handler, and its job is to produce sensible navigation. Every API route
 * independently calls `lib/access/api.ts`, and every table independently
 * enforces RLS. If this file were deleted the platform would be less pleasant to
 * use and no less secure — which is the correct relationship. Defence that
 * exists only at the edge is defence with one point of failure.
 */

/**
 * Refreshes the session and returns both the response carrying updated cookies
 * and the resolved user.
 *
 * The cookie dance matters: Supabase may issue a refreshed token during
 * `getUser()`, and those `Set-Cookie` headers must ride on the response we
 * ultimately return. Creating a fresh `NextResponse` afterwards and discarding
 * this one drops the refreshed session, and the user is silently signed out on
 * the next request.
 */
async function withSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Without Supabase configured there is no session to refresh and no routing
  // decision worth making. Let the request through rather than locking the
  // developer out of a half-configured local environment.
  if (!url || !key) return { response, userId: null as string | null }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // getUser(), never getSession(): the latter reads the cookie and trusts it.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, userId: user?.id ?? null, supabase }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // ── 1. Dev routes ─────────────────────────────────────────────────────────
  // 404 rather than 403: a 403 confirms the route exists, and there is no reason
  // to tell anyone that.
  if (pathname.startsWith('/dev') && process.env.VERCEL_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }

  // API routes, auth callbacks, and static assets manage themselves. API routes
  // in particular must return their own JSON errors from the taxonomy — a
  // redirect here would give a fetch() an HTML login page instead of a 401.
  if (isAlwaysOpen(pathname)) {
    return NextResponse.next()
  }

  // ── 2. Session refresh ────────────────────────────────────────────────────
  const { response, userId, supabase } = await withSession(request)

  // ── 3. Routing ────────────────────────────────────────────────────────────

  const owner = namespaceOwner(pathname)

  // Signed out
  if (!userId) {
    if (owner) {
      // Remember where they were going so login can return them.
      return NextResponse.redirect(new URL(loginRedirect(pathname, search), request.url))
    }
    return response
  }

  // Signed in, on an auth page — send them where they belong rather than showing
  // a login form to someone already logged in.
  if (isAuthPath(pathname)) {
    const role = supabase ? await resolveRole(supabase, userId) : null
    const next = safeNextPath(
      request.nextUrl.searchParams.get('next'),
      role ? ROLE_HOME[role] : '/'
    )
    return NextResponse.redirect(new URL(next, request.url))
  }

  // Public pages are public for everyone, signed in or not.
  if (!owner || isPublicPath(pathname)) {
    return response
  }

  // A namespaced path: confirm the role owns it.
  if (!supabase) return response

  const role = await resolveRole(supabase, userId)

  if (!role) {
    // Authenticated but with no usable profile — role selection has not
    // completed. Sending them onward would land them on a page with no data.
    return NextResponse.redirect(new URL('/auth/select-role', request.url))
  }

  if (role !== owner) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url))
  }

  return response
}

/**
 * Reads the caller's role.
 *
 * From the database, not the JWT: a role change — including a suspension — must
 * take effect on the next request, not whenever the token happens to expire.
 */
async function resolveRole(
  supabase: NonNullable<Awaited<ReturnType<typeof withSession>>['supabase']>,
  userId: string
): Promise<Role | null> {
  const { data } = await supabase
    .from('profiles')
    .select('role, role_confirmed, account_status')
    .eq('id', userId)
    .maybeSingle()

  if (!data) return null
  if (!data.role_confirmed) return null
  if (data.account_status !== 'active') return null

  return data.role as Role
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation, which never need
     * middleware and would only add latency to every asset request.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
}
