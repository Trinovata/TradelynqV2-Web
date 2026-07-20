/**
 * Phone OTP (playbook S056).
 *
 * The properties worth testing here are security properties, not delivery: that
 * a code is hashed and never stored plaintext, that comparison is constant-time,
 * that three wrong guesses destroy the code, that a used code cannot be reused,
 * and that a landline or a foreign number is refused before a message is ever
 * sent. Every one of those is a property of `lib/otp`, so none of them needs
 * Redis or the WhatsApp API — they are exercised through an in-memory store.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  OTP_MAX_ATTEMPTS,
  generateOtp,
  hashOtp,
  hashesMatch,
  normaliseTtPhone,
  verifyOtp,
  type OtpRecord,
  type OtpStore,
} from '@/lib/otp'

// ── An in-memory store, honouring the same contract as Upstash ───────────────
//
// Single-threaded JS makes each method naturally atomic, which is exactly the
// property the split counter needs and Upstash's DECR provides.

function memoryStore(): OtpStore & {
  codes: Map<string, OtpRecord>
  attempts: Map<string, number>
} {
  const codes = new Map<string, OtpRecord>()
  const attempts = new Map<string, number>()
  return {
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
}

function seed(store: OtpStore, userId: string, code: string, attempts = OTP_MAX_ATTEMPTS) {
  return store.issue(
    userId,
    { hash: hashOtp(code, userId), phone: '+18683552214', issuedAt: Date.now() },
    attempts,
    600
  )
}

describe('generateOtp', () => {
  it('is always exactly six digits', () => {
    // A leading zero dropped by a client's number coercion makes a code
    // unenterable, so codes must never be shorter than six characters.
    for (let i = 0; i < 2000; i += 1) {
      expect(generateOtp()).toMatch(/^\d{6}$/)
    }
  })

  it('spreads across the range, including the low decade', () => {
    // A weak generator that never produces 100000–199999 would be a tell. Not a
    // randomness proof — just a smoke test that the low end is reachable.
    const seen = new Set<string>()
    let sawLowDecade = false
    for (let i = 0; i < 5000; i += 1) {
      const code = generateOtp()
      seen.add(code)
      if (code[0] === '1') sawLowDecade = true
    }
    expect(seen.size).toBeGreaterThan(4000)
    expect(sawLowDecade).toBe(true)
  })
})

describe('hashOtp', () => {
  it('never returns the code itself', () => {
    const code = '482913'
    const hash = hashOtp(code, 'user-1')
    expect(hash).not.toContain(code)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('salts by user, so the same code hashes differently for two people', () => {
    // Without the salt, a stolen store lets an attacker learn that two accounts
    // hold the same code by matching hashes.
    expect(hashOtp('482913', 'user-a')).not.toBe(hashOtp('482913', 'user-b'))
  })

  it('is deterministic for the same code and user', () => {
    expect(hashOtp('482913', 'user-1')).toBe(hashOtp('482913', 'user-1'))
  })
})

describe('hashesMatch', () => {
  it('matches identical hashes and rejects different ones', () => {
    const a = hashOtp('111111', 'u')
    expect(hashesMatch(a, a)).toBe(true)
    expect(hashesMatch(a, hashOtp('222222', 'u'))).toBe(false)
  })

  it('rejects a length mismatch without throwing', () => {
    // timingSafeEqual throws on unequal lengths; the guard must convert that
    // into a plain false, or a malformed stored value becomes a 500.
    expect(() => hashesMatch('short', hashOtp('111111', 'u'))).not.toThrow()
    expect(hashesMatch('short', hashOtp('111111', 'u'))).toBe(false)
  })
})

describe('normaliseTtPhone', () => {
  it('accepts the shapes people actually type', () => {
    const forms = [
      '868 355 2214',
      '(868) 355-2214',
      '+1 868 355 2214',
      '18683552214',
      '8683552214',
      '1-868-355-2214',
    ]
    for (const form of forms) {
      expect(normaliseTtPhone(form), form).toBe('+18683552214')
    }
  })

  it('rejects a landline exchange', () => {
    // 868-6XX is a landline and cannot receive WhatsApp; accepting it guarantees
    // a silent delivery failure the user reads as "the code never came".
    expect(normaliseTtPhone('868 625 1000')).toBeNull()
  })

  it('rejects foreign and malformed numbers', () => {
    for (const bad of [
      '+1 212 555 1234',
      '355 2214',
      '',
      'not a phone',
      '868 355 221',
      '18683552214000',
    ]) {
      expect(normaliseTtPhone(bad), bad).toBeNull()
    }
  })

  it('never guesses — a number it cannot parse is null, not a best effort', () => {
    // Returning a "corrected" number would send someone else's code to a
    // stranger. The contract is parse-or-refuse.
    expect(normaliseTtPhone('868')).toBeNull()
  })
})

describe('verifyOtp', () => {
  const userId = 'user-1'

  it('verifies a correct code and returns the number to trust, WITHOUT consuming it', async () => {
    // Persist-before-consume: verifyOtp confirms the match and leaves the record
    // in place so the caller can write phone_verified FIRST and clear the code
    // only once that write lands. Deleting here would strand a user behind a
    // transient DB failure with their one code already spent. The single-use
    // guarantee is therefore a property of the ROUTE (see otp-routes.test.ts),
    // not of this function.
    const store = memoryStore()
    await seed(store, userId, '482913')

    expect(await verifyOtp(store, userId, '482913')).toEqual({
      status: 'verified',
      phone: '+18683552214',
    })
    // Still present — the route clears it after persisting the flag.
    expect(await store.read(userId)).not.toBeNull()
  })

  it('counts down attempts on wrong codes', async () => {
    const store = memoryStore()
    await seed(store, userId, '482913')

    expect(await verifyOtp(store, userId, '000000')).toEqual({ status: 'wrong', attemptsLeft: 2 })
    expect(await verifyOtp(store, userId, '000001')).toEqual({ status: 'wrong', attemptsLeft: 1 })
  })

  it('destroys the code on the third wrong guess', async () => {
    const store = memoryStore()
    await seed(store, userId, '482913')

    await verifyOtp(store, userId, '000000')
    await verifyOtp(store, userId, '000001')
    expect(await verifyOtp(store, userId, '000002')).toEqual({ status: 'exhausted' })

    // Gone. Even the correct code no longer works — a new one must be requested.
    expect(await store.read(userId)).toBeNull()
    expect(await verifyOtp(store, userId, '482913')).toEqual({ status: 'no_code' })
  })

  it('does not let a correct guess on the last attempt be denied', async () => {
    // Boundary: with one attempt left, the RIGHT code must still verify. An
    // off-by-one that decrements before comparing would reject it.
    const store = memoryStore()
    await seed(store, userId, '482913', 1)
    expect(await verifyOtp(store, userId, '482913')).toEqual({
      status: 'verified',
      phone: '+18683552214',
    })
  })

  it('returns no_code when nothing was issued', async () => {
    const store = memoryStore()
    expect(await verifyOtp(store, userId, '482913')).toEqual({ status: 'no_code' })
  })

  it('persists the decremented count between calls', async () => {
    // The count must survive in the store, or each request would reset to three
    // and the limit would be unbounded across separate calls.
    const store = memoryStore()
    await seed(store, userId, '482913')
    await verifyOtp(store, userId, '000000')
    expect(store.attempts.get(userId)).toBe(2)
  })

  it('consumes an attempt per concurrent wrong guess (atomicity)', async () => {
    // The bug this design fixes: with a read-modify-write counter, N concurrent
    // wrong guesses all read the same count and all write count-1, so the code
    // survives far more than its allotted attempts. With an atomic decrement,
    // ten concurrent misses spend ten attempts — the counter goes negative
    // rather than sticking at 2. The memory store's single-threaded spendAttempt
    // models Upstash's atomic DECR.
    const store = memoryStore()
    await seed(store, userId, '482913')

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) => verifyOtp(store, userId, String(100000 + index)))
    )

    // Not one of ten concurrent wrong guesses was let through as anything but a
    // miss, and the code did not survive as if only one attempt had been spent.
    expect(results.every((r) => r.status === 'wrong' || r.status === 'exhausted')).toBe(true)
    const exhausted = results.filter((r) => r.status === 'exhausted').length
    expect(exhausted).toBeGreaterThan(0)
  })
})
