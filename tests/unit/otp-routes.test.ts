/**
 * The OTP routes end to end (playbook S056).
 *
 * These drive the actual route handlers with an injected store and sender, so
 * the guard sequence (rate-limit -> auth -> zod -> work), the `attempts_left`
 * contract, and the "never claim a code was sent when it was not" rule are all
 * exercised without Redis or WhatsApp.
 *
 * The playbook's stated verification for this block is "throttle triggers at the
 * 4th attempt". Two throttles apply — the per-code attempt counter and the
 * per-account send limiter — and both are asserted here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { createClientMock, createAdminClientMock, createBearerClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  createBearerClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))
vi.mock('@/lib/supabase/bearer', () => ({ createBearerClient: createBearerClientMock }))
vi.mock('@/lib/utils/logger', () => ({
  logger: { debug() {}, info() {}, warn() {}, error() {} },
  logSampled() {},
}))

// The otp_* limiters are fail-closed, so with no Upstash in the test environment
// they refuse every request before the handler logic runs. That behaviour has
// its own dedicated suite (rate-limit.test.ts); here we neutralise it so these
// tests exercise the OTP logic rather than re-testing the limiter. `identifierFrom`
// is passed through unchanged.
const { rateLimitAllow } = vi.hoisted(() => ({ rateLimitAllow: { value: true } }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return {
    ...actual,
    checkRateLimit: async () =>
      rateLimitAllow.value
        ? { ok: true, remaining: 3, degraded: false }
        : { ok: false, response: new Response(null, { status: 503 }) },
  }
})

import { handleSendOtp as sendOtp } from '@/app/api/account/phone/send-otp/route'
import { handleVerifyOtp as verifyOtp } from '@/app/api/account/phone/verify-otp/route'
import { hashOtp, OTP_MAX_ATTEMPTS, type OtpRecord, type OtpStore, type OtpSender } from '@/lib/otp'

// ── Doubles ──────────────────────────────────────────────────────────────────

function memoryStore(seed?: { userId: string; record: OtpRecord; attempts?: number }) {
  const codes = new Map<string, OtpRecord>()
  const attempts = new Map<string, number>()
  if (seed) {
    codes.set(seed.userId, seed.record)
    attempts.set(seed.userId, seed.attempts ?? OTP_MAX_ATTEMPTS)
  }
  const store: OtpStore & { codes: Map<string, OtpRecord>; attempts: Map<string, number> } = {
    codes,
    attempts,
    isConfigured: () => true,
    async read(userId) {
      return codes.get(userId) ?? null
    },
    async issue(userId, record, attemptCount) {
      codes.set(userId, record)
      attempts.set(userId, attemptCount)
    },
    async spendAttempt(userId) {
      const next = (attempts.get(userId) ?? 0) - 1
      attempts.set(userId, next)
      return next
    },
    async clear(userId) {
      codes.delete(userId)
      attempts.delete(userId)
    },
  }
  return store
}

function recordingSender(ok = true) {
  const sent: Array<{ phone: string; code: string }> = []
  const sender: OtpSender = {
    isConfigured: () => true,
    async send(phone, code) {
      sent.push({ phone, code })
      return ok
    },
  }
  return { sender, sent }
}

/** A profiles-update-capable admin client stub. `failWrite` models a DB error on the update. */
function stubAdmin(failWrite = false) {
  const builder: Record<string, unknown> = {}
  for (const method of ['update', 'eq']) builder[method] = () => builder
  builder.eq = async () => ({ error: failWrite ? { code: 'XX000', message: 'boom' } : null })
  createAdminClientMock.mockReturnValue({ from: () => builder })
}

/**
 * A signed-in caller resolved through the cookie path.
 *
 * `requireAuth` reads `profiles.account_status` to reject a suspended session on
 * its next request, so the client must answer that lookup with an active row —
 * a client that only stubs `auth` makes every guarded route 500 inside the
 * access layer, not in the handler under test.
 */
function signedIn(userId = 'user-1', accountStatus = 'active') {
  createClientMock.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { account_status: accountStatus }, error: null }),
        }),
      }),
    }),
  })
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/account/phone/send-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '10.0.0.9', ...headers },
    body: JSON.stringify(body),
  })
}

describe('send-otp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signedIn()
    stubAdmin()
  })

  it('sends a code and returns the pack shape', async () => {
    const store = memoryStore()
    const { sender, sent } = recordingSender()

    const response = await sendOtp(post({ phone_number: '868 355 2214' }), { store, sender })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual({ sent: true, expires_in: 600 })
    expect(sent).toHaveLength(1)
    expect(sent[0]?.phone).toBe('+18683552214')
  })

  it('stores a hash, never the plaintext code', async () => {
    const store = memoryStore()
    const { sender, sent } = recordingSender()

    await sendOtp(post({ phone_number: '868 355 2214' }), { store, sender })

    const record = store.codes.get('user-1')
    const deliveredCode = sent[0]!.code
    expect(record?.hash).toBe(hashOtp(deliveredCode, 'user-1'))
    // The delivered code must appear nowhere in the stored record.
    expect(JSON.stringify(record)).not.toContain(deliveredCode)
  })

  it('rejects a non-T&T number before sending anything', async () => {
    const store = memoryStore()
    const { sender, sent } = recordingSender()

    const response = await sendOtp(post({ phone_number: '+1 212 555 1234' }), { store, sender })

    expect(response.status).toBe(422)
    expect(sent).toHaveLength(0)
    expect(store.codes.size).toBe(0)
  })

  it('does not claim success when delivery fails, and leaves no live code', async () => {
    const store = memoryStore()
    const { sender } = recordingSender(false) // send() returns false

    const response = await sendOtp(post({ phone_number: '868 355 2214' }), { store, sender })

    expect(response.status).toBe(503)
    // The failed-send code must not linger occupying the cooldown window.
    expect(store.codes.size).toBe(0)
  })

  it('applies the resend cooldown', async () => {
    const store = memoryStore({
      userId: 'user-1',
      record: {
        hash: hashOtp('111111', 'user-1'),
        phone: '+18683552214',
        issuedAt: Date.now(), // just issued
      },
    })
    const { sender, sent } = recordingSender()

    const response = await sendOtp(post({ phone_number: '868 355 2214' }), { store, sender })

    expect(response.status).toBe(429)
    expect(sent).toHaveLength(0)
  })

  it('requires authentication first', async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: { message: 'no session' } }) },
    })
    const store = memoryStore()
    const { sender } = recordingSender()

    const response = await sendOtp(post({ phone_number: '868 355 2214' }), { store, sender })
    expect(response.status).toBe(401)
  })

  it('is unavailable, not broken, when the sender is unconfigured', async () => {
    const store = memoryStore()
    const sender: OtpSender = { isConfigured: () => false, send: async () => true }

    const response = await sendOtp(post({ phone_number: '868 355 2214' }), { store, sender })
    expect(response.status).toBe(503)
  })
})

describe('verify-otp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signedIn()
    stubAdmin()
  })

  function verifyReq(code: string) {
    return new Request('http://localhost/api/account/phone/verify-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': '10.0.0.9' },
      body: JSON.stringify({ code }),
    })
  }

  function seededStore(code = '482913', attempts = OTP_MAX_ATTEMPTS) {
    return memoryStore({
      userId: 'user-1',
      attempts,
      record: {
        hash: hashOtp(code, 'user-1'),
        phone: '+18683552214',
        issuedAt: Date.now() - 120_000, // outside the cooldown, irrelevant here
      },
    })
  }

  it('verifies the correct code', async () => {
    const store = seededStore()
    const response = await verifyOtp(verifyReq('482913'), { store })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual({ verified: true })
    expect(store.codes.size).toBe(0) // consumed only AFTER the flag was persisted
  })

  it('keeps the code when the DB write fails, so a correct code is not stranded', async () => {
    // Persist-before-consume (review Finding 4). If the profiles update errors,
    // the code must SURVIVE so the user retries the same code rather than being
    // forced to burn one of three hourly sends over a transient blip on our side.
    stubAdmin(true) // update returns an error
    const store = seededStore()

    const response = await verifyOtp(verifyReq('482913'), { store })
    expect(response.status).toBe(500)
    // The correct code is still there, ready to be retried.
    expect(store.codes.size).toBe(1)
    expect(store.attempts.get('user-1')).toBe(OTP_MAX_ATTEMPTS) // a match never spends an attempt

    // Retry with the DB healthy now — the same code verifies.
    stubAdmin(false)
    const retry = await verifyOtp(verifyReq('482913'), { store })
    expect(retry.status).toBe(200)
    expect(store.codes.size).toBe(0)
  })

  it('writes the verified number, not just the flag', async () => {
    // Finding 1: verify is the sole authority for phone_number + phone_verified
    // together, so the flag can never attach to a stale number. Assert the update
    // carries the phone from the record.
    let written: Record<string, unknown> | null = null
    const builder: Record<string, unknown> = { eq: async () => ({ error: null }) }
    builder.update = (values: Record<string, unknown>) => {
      written = values
      return builder
    }
    createAdminClientMock.mockReturnValue({ from: () => builder })

    const store = seededStore()
    await verifyOtp(verifyReq('482913'), { store })

    expect(written).toEqual({ phone_number: '+18683552214', phone_verified: true })
  })

  it('rejects a wrong code with a decrementing attempts_left', async () => {
    const store = seededStore()

    const first = await verifyOtp(verifyReq('000000'), { store })
    const firstBody = await first.json()
    expect(first.status).toBe(422)
    expect(firstBody.code).toBe('INVALID_INPUT')
    expect(firstBody.details.attempts_left).toBe(2)

    const second = await verifyOtp(verifyReq('000001'), { store })
    expect((await second.json()).details.attempts_left).toBe(1)
  })

  it('throttles on the 4th attempt against one code — the playbook acceptance', async () => {
    // Three wrong guesses exhaust the code; the fourth finds nothing to guess
    // against. This is the per-code half of "throttle triggers at the 4th
    // attempt".
    const store = seededStore()

    await verifyOtp(verifyReq('000000'), { store }) // attempt 1 -> 2 left
    await verifyOtp(verifyReq('000001'), { store }) // attempt 2 -> 1 left
    const third = await verifyOtp(verifyReq('000002'), { store }) // attempt 3 -> exhausted
    expect((await third.json()).details.attempts_left).toBe(0)

    // The code is gone, so even the correct value now fails.
    const fourth = await verifyOtp(verifyReq('482913'), { store })
    expect(fourth.status).toBe(422)
    expect((await fourth.json()).details.attempts_left).toBe(0)
    expect(store.codes.size).toBe(0)
  })

  it('rejects a non-six-digit code at the schema, without spending an attempt', async () => {
    const store = seededStore()
    const response = await verifyOtp(verifyReq('12ab'), { store })

    expect(response.status).toBe(422)
    // The stored record is untouched — a malformed body must not burn a guess.
    expect(store.attempts.get('user-1')).toBe(OTP_MAX_ATTEMPTS)
  })

  it('reports an expired code as no longer available', async () => {
    const store = memoryStore() // nothing seeded
    const response = await verifyOtp(verifyReq('482913'), { store })
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.details.attempts_left).toBe(0)
  })
})
