/**
 * The fail-closed matrix (details/backend-processes.md §9), all six cells.
 *
 * These tests exist because V1 shipped a limiter that failed open and nobody noticed
 * for months — production was logging `rate-limit:check_error "fetch failed"` on every
 * request with rate limiting entirely off. The regression these guard against is not
 * theoretical; it already happened once.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  checkRateLimit,
  identifierFrom,
  LIMITERS,
  type RateLimitBackend,
  type LimiterKey,
} from '@/lib/rate-limit'

/** A backend that is not configured at all — the "Redis absent" column. */
const absent: RateLimitBackend = {
  isConfigured: () => false,
  consume: async () => {
    throw new Error('should never be called when unconfigured')
  },
}

/** A backend that is configured but throws — the "Redis erroring" column. */
function erroring(): RateLimitBackend {
  return {
    isConfigured: () => true,
    consume: vi.fn(async () => {
      throw new Error('fetch failed')
    }),
  }
}

/** A backend that errors once then succeeds — the transient blip case. */
function flaky(): RateLimitBackend {
  let calls = 0
  return {
    isConfigured: () => true,
    consume: vi.fn(async () => {
      calls += 1
      if (calls === 1) throw new Error('fetch failed')
      return { allowed: true, remaining: 4, resetSeconds: 60 }
    }),
  }
}

/** A healthy backend with a configurable verdict. */
function healthy(allowed: boolean, resetSeconds = 30): RateLimitBackend {
  return {
    isConfigured: () => true,
    consume: async () => ({ allowed, remaining: allowed ? 7 : 0, resetSeconds }),
  }
}

const SENSITIVE: LimiterKey = 'auth'
const PUBLIC_READ: LimiterKey = 'search'
const OTHER_MUTATION: LimiterKey = 'enquiry'

beforeEach(() => {
  vi.restoreAllMocks()
  // Silence the deliberate error logging these tests provoke.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('matrix cell 1 — sensitive route, Redis absent', () => {
  it('fails closed with 503, not 429', async () => {
    const outcome = await checkRateLimit(SENSITIVE, 'ip:1.2.3.4', absent)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.response.status).toBe(503)
  })

  it('carries code RATE_LIMITED and human copy', async () => {
    const outcome = await checkRateLimit(SENSITIVE, 'ip:1.2.3.4', absent)
    if (outcome.ok) throw new Error('expected refusal')
    const body = (await outcome.response.json()) as { code: string; error: string }
    expect(body.code).toBe('RATE_LIMITED')
    expect(body.error).toBe('Please try again in a moment.')
  })
})

describe('matrix cell 2 — sensitive route, Redis erroring', () => {
  it('retries exactly once, then fails closed', async () => {
    const backend = erroring()
    const outcome = await checkRateLimit(SENSITIVE, 'ip:1.2.3.4', backend)

    expect(backend.consume).toHaveBeenCalledTimes(2)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.response.status).toBe(503)
  })

  it('allows the request when the retry succeeds — a blip must not lock users out', async () => {
    const backend = flaky()
    const outcome = await checkRateLimit(SENSITIVE, 'ip:1.2.3.4', backend)

    expect(backend.consume).toHaveBeenCalledTimes(2)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.degraded).toBe(true)
  })
})

describe('matrix cell 3 — public read, Redis absent', () => {
  it('fails open so the marketplace stays browsable', async () => {
    const outcome = await checkRateLimit(PUBLIC_READ, 'ip:1.2.3.4', absent)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.degraded).toBe(true)
  })
})

describe('matrix cell 4 — public read, Redis erroring', () => {
  it('fails open and does not retry (availability wins)', async () => {
    const backend = erroring()
    const outcome = await checkRateLimit(PUBLIC_READ, 'ip:1.2.3.4', backend)

    expect(backend.consume).toHaveBeenCalledTimes(1)
    expect(outcome.ok).toBe(true)
  })
})

describe('matrix cell 5 — other authenticated mutation, Redis absent', () => {
  it('fails open at launch scale', async () => {
    const outcome = await checkRateLimit(OTHER_MUTATION, 'user:abc', absent)
    expect(outcome.ok).toBe(true)
  })
})

describe('matrix cell 6 — other authenticated mutation, Redis erroring', () => {
  it('fails open with a warning', async () => {
    const outcome = await checkRateLimit(OTHER_MUTATION, 'user:abc', erroring())
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.degraded).toBe(true)
  })
})

describe('healthy backend — normal operation', () => {
  it('allows a request within the limit and reports remaining', async () => {
    const outcome = await checkRateLimit(SENSITIVE, 'ip:1.2.3.4', healthy(true))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.remaining).toBe(7)
    expect(outcome.degraded).toBe(false)
  })

  it('refuses an over-limit request with 429 — distinct from the 503 outage status', async () => {
    const outcome = await checkRateLimit(SENSITIVE, 'ip:1.2.3.4', healthy(false, 30))
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.response.status).toBe(429)
    expect(outcome.response.headers.get('Retry-After')).toBe('30')
  })

  it('never advertises Retry-After 0 — a zero would invite an immediate retry loop', async () => {
    const outcome = await checkRateLimit(PUBLIC_READ, 'ip:1.2.3.4', healthy(false, 0))
    if (outcome.ok) throw new Error('expected refusal')
    expect(outcome.response.headers.get('Retry-After')).toBe('1')
  })
})

describe('limiter configuration', () => {
  it('classifies every sensitive route as fail-closed', () => {
    for (const key of ['auth', 'payment', 'kyc', 'admin_mutation'] as const) {
      expect(LIMITERS[key].failureMode, `${key} must fail closed`).toBe('closed')
    }
  })

  it('classifies public reads as fail-open', () => {
    expect(LIMITERS.search.failureMode).toBe('open')
  })

  it('gives every limiter a rationale — the number alone does not survive an incident', () => {
    for (const [key, config] of Object.entries(LIMITERS)) {
      expect(config.rationale.length, `${key} needs a rationale`).toBeGreaterThan(20)
      expect(config.limit).toBeGreaterThan(0)
      expect(config.windowSeconds).toBeGreaterThan(0)
    }
  })
})

describe('identifier derivation', () => {
  it('prefers the authenticated user id over IP', () => {
    const request = new Request('https://tradelynq.tech/api/x', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    expect(identifierFrom(request, 'user-123')).toBe('user:user-123')
  })

  it('prefers the platform-set header over anything the client can write', () => {
    // SECURITY (fixed 20 Jul 2026). This previously took x-forwarded-for[0] — the
    // end of the chain the CLIENT writes. Proxies append; they do not verify what
    // is already there. On login there is no userId, so the fail-closed 5/min
    // `auth` limiter keyed entirely on an attacker-controlled string: rotate it
    // per request and credential stuffing is unbounded.
    const request = new Request('https://tradelynq.tech/api/x', {
      headers: {
        // Written by the caller…
        'x-forwarded-for': '1.1.1.1, 203.0.113.9',
        // …and this one is set by the platform on every request.
        'x-vercel-forwarded-for': '203.0.113.9',
      },
    })
    expect(identifierFrom(request)).toBe('ip:203.0.113.9')
  })

  it('cannot be evaded by rotating the client-written end of the chain', () => {
    // Two requests from one real client, forging different leading entries. They
    // must land in the SAME bucket, or the limiter counts to one forever.
    const first = new Request('https://tradelynq.tech/api/x', {
      headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.9' },
    })
    const second = new Request('https://tradelynq.tech/api/x', {
      headers: { 'x-forwarded-for': '8.8.8.8, 203.0.113.9' },
    })

    expect(identifierFrom(first)).toBe(identifierFrom(second))
    expect(identifierFrom(first)).toBe('ip:203.0.113.9')
  })

  it('rejects a header value that is not an address', () => {
    // The value becomes a Redis key, so an unvalidated header is both a spoofing
    // vector and an unbounded key.
    const junk = new Request('https://tradelynq.tech/api/x', {
      headers: { 'x-real-ip': 'not-an-ip-at-all' },
    })
    expect(identifierFrom(junk)).toBe('ip:unidentified')

    const huge = new Request('https://tradelynq.tech/api/x', {
      headers: { 'x-real-ip': 'a'.repeat(500) },
    })
    expect(identifierFrom(huge)).toBe('ip:unidentified')
  })

  it('accepts IPv6 and addresses carrying a port', () => {
    const v6 = new Request('https://tradelynq.tech/api/x', {
      headers: { 'x-real-ip': '2001:db8::1' },
    })
    expect(identifierFrom(v6)).toBe('ip:2001:db8::1')

    const withPort = new Request('https://tradelynq.tech/api/x', {
      headers: { 'x-real-ip': '203.0.113.9:44321' },
    })
    expect(identifierFrom(withPort)).toBe('ip:203.0.113.9:44321')
  })

  it('still prefers a proven user id over any header', () => {
    const request = new Request('https://tradelynq.tech/api/x', {
      headers: { 'x-vercel-forwarded-for': '203.0.113.9' },
    })
    expect(identifierFrom(request, 'user-123')).toBe('user:user-123')
  })

  it('falls back to one shared bucket when nothing identifies the caller', () => {
    // Deliberately shared: on a fail-closed limiter an anonymous flood should be
    // throttled together, not let each request mint itself a fresh key.
    const bare = new Request('https://tradelynq.tech/api/x')
    expect(identifierFrom(bare)).toBe('ip:unidentified')
  })
})
