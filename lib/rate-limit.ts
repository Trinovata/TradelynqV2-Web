/**
 * Rate limiting, with the fail-closed matrix (D23 — the launch-blocking security fix).
 *
 * ## Why this file is written the way it is
 *
 * V1's limiter fails **open** whenever Upstash is unreachable. On 19 July 2026 that
 * turned out not to be hypothetical: production had been logging
 * `rate-limit:check_error "fetch failed"` on every single request, meaning rate
 * limiting had been silently off in production for an unknown period. The environment
 * variables were present and correct — the Redis instance itself was unreachable — so
 * an env-var check would not have caught it either.
 *
 * That is the failure mode this module is built against: **not "someone forgot to set
 * a variable", but "the dependency is gone and nothing says so."** Hence two rules:
 *
 * 1. Sensitive routes (auth, payments, KYC, admin mutations) **fail closed**. If we
 *    cannot verify the limit, we refuse the request. Refusing a real user is
 *    recoverable; silently accepting unlimited credential-stuffing attempts is not.
 * 2. The failure is **loud**. Every degraded check logs, and production deployments
 *    refuse to boot without the variables (see `assertProductionEnv` in lib/env.ts).
 *
 * ## The matrix (details/backend-processes.md §9)
 *
 * | Route class            | Redis absent      | Redis erroring at runtime      |
 * |------------------------|-------------------|--------------------------------|
 * | Sensitive              | fail closed (503) | fail closed after one retry    |
 * | Public reads           | fail open         | fail open + sampled warning    |
 * | Other auth. mutations  | fail open         | fail open + warning            |
 *
 * Fail-closed responses are **503**, not 429, carrying code `RATE_LIMITED`. The
 * distinction is deliberate and the spec is explicit about it: 429 means "you exceeded
 * your limit"; 503 means "we cannot verify your limit and are refusing". Same code so
 * client copy stays in one dictionary; different status so infrastructure, retries,
 * and dashboards can tell an attack apart from an outage.
 */
import { NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { logger, logSampled } from '@/lib/utils/logger'

// ── Route classes ────────────────────────────────────────────────────────────

/**
 * What to do when the limit cannot be verified.
 *
 * `closed` — refuse the request. For anything where unlimited attempts are an attack:
 *   credential stuffing, payment probing, KYC document flooding, admin mutation abuse.
 * `open` — allow the request. For anything where availability outranks the limit:
 *   public reads, and (at launch scale) ordinary authenticated mutations.
 */
export type FailureMode = 'closed' | 'open'

export type LimiterKey =
  | 'api'
  | 'auth'
  | 'payment'
  | 'kyc'
  | 'otp_send'
  | 'otp_verify'
  | 'admin_mutation'
  | 'enquiry'
  | 'review'
  | 'search'
  | 'chatbot'
  | 'feedback'
  | 'ai_tool'

type LimiterConfig = {
  /** Requests permitted per window. */
  limit: number
  /** Window length in seconds. */
  windowSeconds: number
  failureMode: FailureMode
  /** Why this limit exists — read during incidents, so state the threat, not the number. */
  rationale: string
}

export const LIMITERS: Record<LimiterKey, LimiterConfig> = {
  api: {
    limit: 120,
    windowSeconds: 60,
    failureMode: 'open',
    rationale: 'Global backstop against runaway clients; availability outranks it at launch scale.',
  },
  auth: {
    limit: 5,
    windowSeconds: 60,
    failureMode: 'closed',
    rationale:
      'Credential stuffing and OTP brute force. Unlimited attempts here compromise accounts.',
  },
  payment: {
    limit: 10,
    windowSeconds: 60,
    failureMode: 'closed',
    rationale: 'Card testing and checkout replay. Unverified limits here cost real money.',
  },
  kyc: {
    limit: 5,
    windowSeconds: 3600,
    failureMode: 'closed',
    rationale: 'Document flooding into the manual review queue; each submission costs staff time.',
  },
  otp_send: {
    limit: 3,
    windowSeconds: 3600,
    failureMode: 'closed',
    rationale:
      'Each send costs a WhatsApp message and can be aimed at a number the caller does not own — an unbounded sender is an SMS-bombing tool. 3/hour per the API pack §1.2.',
  },
  otp_verify: {
    limit: 10,
    windowSeconds: 3600,
    failureMode: 'closed',
    rationale:
      'Backstop under the per-code attempt counter. The counter bounds guesses against ONE code; this bounds guesses across repeatedly re-requested codes.',
  },
  admin_mutation: {
    limit: 60,
    windowSeconds: 60,
    failureMode: 'closed',
    rationale:
      'Admin actions are high-privilege; a compromised session must not act without bound.',
  },
  enquiry: {
    limit: 3,
    windowSeconds: 60,
    failureMode: 'open',
    rationale:
      'Spam to professionals. Genuine users rarely exceed this; degrade open to protect conversion.',
  },
  review: {
    limit: 2,
    windowSeconds: 60,
    failureMode: 'open',
    rationale: 'Review bombing. Moderation catches what slips through when degraded.',
  },
  search: {
    limit: 30,
    windowSeconds: 60,
    failureMode: 'open',
    rationale:
      'Scraping. A public read path — availability wins; the marketplace must stay browsable.',
  },
  chatbot: {
    limit: 10,
    windowSeconds: 60,
    failureMode: 'open',
    rationale:
      'Model spend per session. Bounded by credits too, so degrading open is not unbounded cost.',
  },
  feedback: {
    limit: 5,
    windowSeconds: 60,
    failureMode: 'open',
    rationale: 'Inbox spam. Low blast radius.',
  },
  ai_tool: {
    limit: 20,
    windowSeconds: 60,
    failureMode: 'open',
    rationale: 'Model spend. Tool credits are the real bound; this limiter only smooths bursts.',
  },
}

// ── The backend seam ─────────────────────────────────────────────────────────

export type ConsumeResult = {
  allowed: boolean
  remaining: number
  /** Seconds until the window resets — surfaced to the client as Retry-After. */
  resetSeconds: number
}

/**
 * The storage behind the limiter, expressed as an interface so the six cells of the
 * matrix are testable without standing up Redis or mutating the environment.
 */
export type RateLimitBackend = {
  isConfigured(): boolean
  consume(key: LimiterKey, identifier: string): Promise<ConsumeResult>
}

let cachedRedis: Redis | undefined
let cachedLimiters: Partial<Record<LimiterKey, Ratelimit>> = {}

function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

function limiterFor(key: LimiterKey): Ratelimit {
  const existing = cachedLimiters[key]
  if (existing) return existing

  cachedRedis ??= new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL as string,
    token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
  })

  const config = LIMITERS[key]
  const created = new Ratelimit({
    redis: cachedRedis,
    limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
    prefix: `tl:rl:${key}`,
    analytics: false,
  })

  cachedLimiters[key] = created
  return created
}

export const upstashBackend: RateLimitBackend = {
  isConfigured: upstashConfigured,
  async consume(key, identifier) {
    const result = await limiterFor(key).limit(identifier)
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetSeconds: Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
    }
  },
}

/** Test seam. Resets memoised clients so environment changes take effect. */
export function __resetRateLimitCaches(): void {
  cachedRedis = undefined
  cachedLimiters = {}
}

// ── The check ────────────────────────────────────────────────────────────────

export type RateLimitOutcome =
  { ok: true; remaining: number; degraded: boolean } | { ok: false; response: NextResponse }

/** How long to wait before the single retry when Redis errors on a fail-closed route. */
const RETRY_DELAY_MS = 250

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 429 — the caller genuinely exceeded their limit.
 */
function limitExceededResponse(key: LimiterKey, resetSeconds: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil(resetSeconds))
  return NextResponse.json(
    {
      code: 'RATE_LIMITED',
      error: 'Too many requests. Please try again shortly.',
      details: { retryAfterSeconds: retryAfter, limiter: key },
    },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}

/**
 * 503 — we could not verify the limit, so we refuse. Copy is human, per the spec's
 * acceptance criteria: it tells the user what to do, and does not blame them for an
 * outage that is ours.
 */
function failClosedResponse(key: LimiterKey): NextResponse {
  return NextResponse.json(
    {
      code: 'RATE_LIMITED',
      error: 'Please try again in a moment.',
      details: { retryAfterSeconds: 5, limiter: key },
    },
    { status: 503, headers: { 'Retry-After': '5' } }
  )
}

/**
 * Applies the named limiter to an identifier (user id, or IP for anonymous callers).
 *
 * Returns a discriminated union matching the access-helper convention, so route
 * handlers read uniformly:
 *
 * ```ts
 * const limit = await checkRateLimit('auth', ip)
 * if (!limit.ok) return limit.response
 * ```
 */
export async function checkRateLimit(
  key: LimiterKey,
  identifier: string,
  backend: RateLimitBackend = upstashBackend
): Promise<RateLimitOutcome> {
  const config = LIMITERS[key]
  const failClosed = config.failureMode === 'closed'

  // ── Cell 1 & 3 & 5: the backend is not configured at all ──
  if (!backend.isConfigured()) {
    if (failClosed) {
      logger.error('rate_limit:unconfigured_fail_closed', {
        limiter: key,
        consequence: 'request refused — cannot verify limit on a sensitive route',
      })
      return { ok: false, response: failClosedResponse(key) }
    }

    logSampled('warn', 'rate_limit:unconfigured_fail_open', 0.01, { limiter: key })
    return { ok: true, remaining: config.limit, degraded: true }
  }

  // ── Cells 2, 4 & 6: configured, but the call may still fail ──
  try {
    const result = await backend.consume(key, identifier)
    if (!result.allowed) {
      return { ok: false, response: limitExceededResponse(key, result.resetSeconds) }
    }
    return { ok: true, remaining: result.remaining, degraded: false }
  } catch (firstError) {
    // Sensitive routes get exactly one retry before refusing — a transient blip
    // should not lock users out of signing in, but a sustained outage must not
    // silently disable the limiter the way V1's did.
    if (failClosed) {
      await sleep(RETRY_DELAY_MS)
      try {
        const retry = await backend.consume(key, identifier)
        if (!retry.allowed) {
          return { ok: false, response: limitExceededResponse(key, retry.resetSeconds) }
        }
        logger.warn('rate_limit:recovered_after_retry', { limiter: key })
        return { ok: true, remaining: retry.remaining, degraded: true }
      } catch (retryError) {
        logger.error('rate_limit:error_fail_closed', {
          limiter: key,
          error: String(retryError),
          consequence: 'request refused after one retry — sensitive route',
        })
        return { ok: false, response: failClosedResponse(key) }
      }
    }

    logSampled('warn', 'rate_limit:error_fail_open', 0.05, {
      limiter: key,
      error: String(firstError),
    })
    return { ok: true, remaining: config.limit, degraded: true }
  }
}

/**
 * Shape check for an identifier derived from a header.
 *
 * A rate-limit key goes straight into Redis, so an unvalidated header value is
 * both a spoofing vector and an unbounded key. Accepts IPv4 and IPv6 and nothing
 * else — a value that is not an address is not an address, whatever it claims.
 */
function isPlausibleIp(value: string): boolean {
  if (value.length === 0 || value.length > 45) return false
  // IPv4, optionally with a port (some proxies append one).
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d{1,5})?$/.test(value)) return true
  // IPv6, including the bracketed-with-port form.
  if (value.includes(':') && /^\[?[0-9a-fA-F:.]{2,45}\]?(:\d{1,5})?$/.test(value)) return true
  return false
}

/**
 * Derives the rate-limit identifier from a request.
 *
 * ## Why this is not simply `x-forwarded-for[0]`
 *
 * SECURITY FIX (20 Jul 2026). The previous version took the FIRST entry of
 * `x-forwarded-for`, reasoning that the first entry is the client. That is true
 * of a well-behaved chain — and the first entry is also the part the CLIENT
 * writes. Proxies append to that header; they do not verify what was already in
 * it.
 *
 * On the login path there is no `userId`, so the fail-closed 5/min `auth`
 * limiter keyed entirely on an attacker-controlled string: rotate the first
 * entry per request and credential stuffing is unbounded. The converse is
 * arguably worse — forge a victim's address to exhaust their auth budget and
 * lock them out of their own account.
 *
 * The order below prefers values a client cannot forge:
 *
 *   1. `userId` — proven by a validated session.
 *   2. `x-vercel-forwarded-for` — platform-set and overwritten every request, so
 *      a client-supplied copy cannot survive.
 *   3. `x-real-ip` — also platform-set.
 *   4. The LAST `x-forwarded-for` entry — the hop nearest us, i.e. the one our
 *      own infrastructure appended, rather than the furthest one the caller
 *      wrote.
 *
 * Note this is the opposite end of the chain from the usual "find the real
 * client IP" advice. That advice optimises for accurate attribution; this
 * optimises for non-forgeability, which is the right trade for a security
 * control. Behind a single trusted proxy the two coincide.
 *
 * @param trustedProxyCount How many proxies sit in front of the app. Used only
 *   for the `x-forwarded-for` fallback; the platform headers are preferred.
 */
export function identifierFrom(
  request: Request,
  userId?: string | null,
  trustedProxyCount = 1
): string {
  if (userId) return `user:${userId}`

  // Platform-set, not client-forgeable.
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for')?.trim()
  if (vercelForwarded && isPlausibleIp(vercelForwarded)) return `ip:${vercelForwarded}`

  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp && isPlausibleIp(realIp)) return `ip:${realIp}`

  // Fall back to the chain, counted from OUR end.
  const chain = request.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (chain && chain.length > 0) {
    const index = Math.max(0, chain.length - trustedProxyCount)
    const candidate = chain[index] ?? chain[chain.length - 1]
    if (candidate && isPlausibleIp(candidate)) return `ip:${candidate}`
  }

  // Deliberately one shared bucket. Every unidentifiable caller competes for a
  // single allowance, which is restrictive by design: on a fail-closed limiter
  // an anonymous flood should be throttled together, not let each request mint
  // itself a fresh key.
  return 'ip:unidentified'
}
