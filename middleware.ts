import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware.
 *
 * Currently guards development-only routes. Session refresh and role-namespace
 * routing land at playbook S050, on top of this.
 *
 * `/dev/*` holds the component kit and the design-direction comparison page.
 * They render internal state and unreleased design work, so they must not be
 * reachable in production. Returning 404 rather than 403 is deliberate: a 403
 * confirms the route exists, and there is no reason to tell anyone that.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/dev')) {
    // VERCEL_ENV is 'production' only for real production deployments —
    // previews and local development both fall through and keep the routes.
    if (process.env.VERCEL_ENV === 'production') {
      return new NextResponse(null, { status: 404 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation, which never need
     * middleware and would only add latency to every asset request.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)',
  ],
}
