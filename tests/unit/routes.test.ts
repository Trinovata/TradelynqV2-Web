/**
 * The route contract carries two security-relevant behaviours: prefix matching
 * that must not leak across namespaces, and `next` validation that must not
 * become an open redirect.
 *
 * An open redirect on a login page is particularly nasty — the user has just
 * been asked to trust the page with a password, and is then sent off-site.
 */
import { describe, it, expect } from 'vitest'
import {
  ROLE_HOME,
  ROUTE_NAMESPACES,
  isPublicPath,
  isAuthPath,
  isAlwaysOpen,
  namespaceOwner,
  loginRedirect,
  safeNextPath,
} from '@/lib/routes'

describe('namespace ownership', () => {
  it('assigns each namespaced path to exactly one role', () => {
    expect(namespaceOwner('/dashboard')).toBe('professional')
    expect(namespaceOwner('/home')).toBe('customer')
    expect(namespaceOwner('/admin')).toBe('admin')
    expect(namespaceOwner('/admin/kyc')).toBe('admin')
  })

  it('matches on a path boundary, never a bare string prefix', () => {
    // '/home' must not claim '/homeowner-guide'. Without the boundary check, a
    // public marketing page would be swallowed by a private namespace and
    // redirect signed-out visitors to login.
    expect(namespaceOwner('/homeowner-guide')).toBeNull()
    expect(namespaceOwner('/dashboards-public')).toBeNull()
    expect(namespaceOwner('/administrator')).toBeNull()
  })

  it('returns null for public paths', () => {
    expect(namespaceOwner('/')).toBeNull()
    expect(namespaceOwner('/pricing')).toBeNull()
    expect(namespaceOwner('/professionals/ravi-plumbing')).toBeNull()
  })

  it('never assigns one path to two roles', () => {
    const seen = new Map<string, string>()
    for (const [role, prefixes] of Object.entries(ROUTE_NAMESPACES)) {
      for (const prefix of prefixes) {
        const existing = seen.get(prefix)
        expect(existing, `${prefix} claimed by both ${existing} and ${role}`).toBeUndefined()
        seen.set(prefix, role)
      }
    }
  })

  it('gives every role a home inside its own namespace', () => {
    for (const [role, home] of Object.entries(ROLE_HOME)) {
      expect(namespaceOwner(home), `${role} home must be in its own namespace`).toBe(role)
    }
  })
})

describe('public and open paths', () => {
  it('treats the landing page and marketplace as public', () => {
    expect(isPublicPath('/')).toBe(true)
    expect(isPublicPath('/pricing')).toBe(true)
    expect(isPublicPath('/professionals/ravi-plumbing')).toBe(true)
  })

  it('treats token pages as public', () => {
    // Quotes and invoices are shared over WhatsApp to people with no account.
    // If these required a session the feature would not work at all.
    expect(isPublicPath('/q/abc123')).toBe(true)
    expect(isPublicPath('/i/abc123')).toBe(true)
    expect(isPublicPath('/portal/abc123')).toBe(true)
  })

  it('leaves API routes entirely alone', () => {
    // A redirect here would hand a fetch() an HTML login page instead of a 401
    // from the error taxonomy.
    expect(isAlwaysOpen('/api/health')).toBe(true)
    expect(isAlwaysOpen('/api/enquiries/create')).toBe(true)
    expect(isAlwaysOpen('/auth/callback')).toBe(true)
  })

  it('defaults to private — an unclassified path is not public', () => {
    expect(isPublicPath('/some-new-internal-page')).toBe(false)
  })

  it('identifies auth pages', () => {
    expect(isAuthPath('/login')).toBe(true)
    expect(isAuthPath('/signup')).toBe(true)
    expect(isAuthPath('/reset-password')).toBe(true)
    expect(isAuthPath('/home')).toBe(false)
  })
})

describe('loginRedirect', () => {
  it('encodes the destination so query strings survive', () => {
    expect(loginRedirect('/dashboard')).toBe('/login?next=%2Fdashboard')
    expect(loginRedirect('/enquiries', '?status=pending')).toBe(
      '/login?next=%2Fenquiries%3Fstatus%3Dpending'
    )
  })
})

describe('safeNextPath — open redirect prevention', () => {
  it('accepts a same-origin absolute path', () => {
    expect(safeNextPath('/dashboard', '/home')).toBe('/dashboard')
    expect(safeNextPath('/enquiries?status=pending', '/home')).toBe('/enquiries?status=pending')
  })

  it('rejects an absolute URL', () => {
    expect(safeNextPath('https://evil.example', '/home')).toBe('/home')
    expect(safeNextPath('http://evil.example/phish', '/home')).toBe('/home')
  })

  it('rejects a protocol-relative URL', () => {
    // '//evil.example' looks like a path but resolves OFF-ORIGIN in a browser.
    // This is the one most often missed.
    expect(safeNextPath('//evil.example', '/home')).toBe('/home')
    expect(safeNextPath('//evil.example/phish', '/home')).toBe('/home')
  })

  it('rejects anything with a scheme, including obscure ones', () => {
    expect(safeNextPath('javascript://evil', '/home')).toBe('/home')
    expect(safeNextPath('data://text/html', '/home')).toBe('/home')
  })

  it('rejects a relative path that could escape', () => {
    expect(safeNextPath('dashboard', '/home')).toBe('/home')
    expect(safeNextPath('../admin', '/home')).toBe('/home')
  })

  it('falls back when absent', () => {
    expect(safeNextPath(null, '/home')).toBe('/home')
    expect(safeNextPath(undefined, '/home')).toBe('/home')
    expect(safeNextPath('', '/home')).toBe('/home')
  })
})
