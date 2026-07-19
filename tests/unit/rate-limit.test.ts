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

  it('takes the FIRST x-forwarded-for entry — the client, not the proxy', () => {
    const request = new Request('https://tradelynq.tech/api/x', {
      headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1, 10.0.0.2' },
    })
    // Taking the last entry would key every request to the same proxy address and
    // rate-limit the entire platform as a single caller.
    expect(identifierFrom(request)).toBe('ip:203.0.113.9')
  })

  it('falls back to x-real-ip, then to a stable unknown', () => {
    const withReal = new Request('https://tradelynq.tech/api/x', {
      headers: { 'x-real-ip': '198.51.100.7' },
    })
    expect(identifierFrom(withReal)).toBe('ip:198.51.100.7')

    const bare = new Request('https://tradelynq.tech/api/x')
    expect(identifierFrom(bare)).toBe('ip:unknown')
  })
})
