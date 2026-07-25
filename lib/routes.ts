/**
 * The route contract (spec master/06 §6.2).
 *
 * Middleware, layouts, and end-to-end tests all import from here, so navigation
 * rules cannot drift between what the server enforces and what the tests assume.
 * A route namespace defined in three places is a route namespace that is wrong
 * in two of them.
 */

export type Role = 'customer' | 'professional' | 'admin'

/**
 * Where each role lands after signing in, and where a wrong-namespace request is
 * redirected to.
 */
export const ROLE_HOME: Record<Role, string> = {
  customer: '/home',
  professional: '/dashboard',
  admin: '/admin',
} as const

/**
 * Path prefixes owned by each role.
 *
 * Order matters within an array only for readability; matching is by prefix, so
 * a longer prefix must not be shadowed by a shorter one belonging to another
 * role. There are deliberately no overlaps.
 */
export const ROUTE_NAMESPACES: Record<Role, readonly string[]> = {
  // DECISION (reconciles the copy-deck vs route-contract conflict the audit
  // flagged): the professional workspace (playbook S105, built and shipped)
  // owns the flat paths its sidebar names — /enquiries, /jobs, /invoices, etc.
  // The customer portal (v2/04, Phase 5, not yet built) therefore does NOT reuse
  // those top-level paths; its received-work views will nest under /home
  // (e.g. /home/enquiries, /home/jobs, /home/invoices) so no path is owned twice.
  customer: ['/home', '/saved', '/kyc'],
  professional: [
    '/dashboard',
    '/onboarding',
    '/enquiries',
    '/quotes',
    '/jobs',
    '/bookings',
    '/invoices',
    '/clients',
    '/storefront',
    '/portfolio',
    '/offerings',
    '/reviews',
    '/analytics',
    '/readiness',
    '/referrals',
    '/subscription',
    '/credits',
    '/integrations',
    '/settings',
  ],
  admin: ['/admin'],
} as const

/**
 * Paths reachable without a session.
 *
 * Everything not listed here and not matching a namespace above requires
 * authentication — the default is closed, so forgetting to classify a new route
 * makes it private rather than public.
 */
export const PUBLIC_PREFIXES: readonly string[] = [
  '/',
  '/professionals',
  '/businesses',
  '/categories',
  '/catalogue',
  '/pricing',
  '/for-professionals',
  '/guides',
  '/customer-guide',
  '/bundles',
  '/about',
  '/why-tradelynq',
  '/trust',
  '/faq',
  '/support',
  '/feedback',
  '/legal',
  '/merch',
  '/search',
  // Public token pages: quotes, invoices, and portals shared over WhatsApp to
  // people who may have no account at all.
  '/q',
  '/i',
  '/invoice',
  '/portal',
] as const

/** Auth pages. A signed-in user visiting these is redirected to their home. */
export const AUTH_PREFIXES: readonly string[] = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
] as const

/** Paths that must never require a session or a redirect. */
export const ALWAYS_OPEN_PREFIXES: readonly string[] = [
  '/api',
  '/auth',
  '/_next',
  '/monitoring',
  '/dev',
] as const

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => {
    if (prefix === '/') return pathname === '/'
    // Guard the boundary: '/home' must not match '/homeowner-something'.
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
  })
}

export function isAlwaysOpen(pathname: string): boolean {
  return matchesPrefix(pathname, ALWAYS_OPEN_PREFIXES)
}

export function isPublicPath(pathname: string): boolean {
  return matchesPrefix(pathname, PUBLIC_PREFIXES)
}

export function isAuthPath(pathname: string): boolean {
  return matchesPrefix(pathname, AUTH_PREFIXES)
}

/** Which role owns this path, or null if it belongs to no namespace. */
export function namespaceOwner(pathname: string): Role | null {
  for (const role of ['admin', 'professional', 'customer'] as const) {
    if (matchesPrefix(pathname, ROUTE_NAMESPACES[role])) return role
  }
  return null
}

/**
 * Builds a login redirect that returns the user where they were going.
 *
 * The `next` value is a PATH, never a full URL — accepting a URL here would make
 * this an open redirect, where `?next=https://evil.example` sends a user
 * off-site immediately after they authenticate, on a page they trust.
 */
export function loginRedirect(pathname: string, search?: string): string {
  const target = search ? `${pathname}${search}` : pathname
  return `/login?next=${encodeURIComponent(target)}`
}

/**
 * Validates a `next` parameter before redirecting to it.
 *
 * Only a same-origin absolute path is acceptable. Rejects protocol-relative
 * URLs (`//evil.example`), absolute URLs, and anything not starting with `/`.
 */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback
  if (!next.startsWith('/')) return fallback
  // `//host` is protocol-relative and resolves off-origin in a browser.
  if (next.startsWith('//')) return fallback
  if (next.includes('://')) return fallback
  return next
}
