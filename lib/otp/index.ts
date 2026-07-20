/**
 * Phone verification codes (playbook S056, contract `details/api-marketplace.md` §1.2).
 *
 * ## Why this does not use Supabase phone auth
 *
 * Supabase's phone provider needs an SMS gateway (Twilio et al). V1 does not use
 * it, and that decision is worth keeping: in Trinidad & Tobago WhatsApp is the
 * primary messaging channel, so the code is generated here and delivered over
 * WhatsApp. No SMS provider, no per-message SMS cost, and delivery on the
 * channel people actually read.
 *
 * ## What changed from V1
 *
 * V1 stores a hash of the code in Redis for ten minutes and compares on submit.
 * That much is ported unchanged, and the hash matters: a Redis dump of plaintext
 * codes is a set of live credentials, while a dump of hashes is not.
 *
 * **V1 counts no attempts.** A six-digit code has a million possibilities, but
 * the code lives for ten minutes and V1 bounds guesses only by an IP-keyed
 * limiter of 10 per 15 minutes — so a single code can be attacked roughly 400
 * times before it expires, from one address, and more from several. The API pack
 * specifies `attempts_left`, and this module enforces it: **three tries per
 * code**, after which the code is destroyed and a new one must be requested.
 *
 * The two bounds do different jobs and both are needed. The attempt counter
 * bounds guesses against *one* code; the `otp_send` limiter (3/hour) bounds how
 * many fresh codes an attacker can mint to reset that counter.
 *
 * ## Seams
 *
 * The store and the sender are interfaces. Neither Upstash nor the WhatsApp
 * Business API is reachable in CI or on a laptop, and the properties worth
 * testing — the code is hashed not stored, attempts decrement, an exhausted code
 * is destroyed, comparison is constant-time — are all properties of this module
 * rather than of the network.
 */
import 'server-only'
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { logger } from '@/lib/utils/logger'

/** Ten minutes, per the pack's `expires_in: 600`. */
export const OTP_TTL_SECONDS = 600

/** Tries per issued code. The pack's example shows `attempts_left: 2` after one miss. */
export const OTP_MAX_ATTEMPTS = 3

/**
 * Minimum gap between sends, on top of the 3/hour limiter.
 *
 * The limiter stops abuse; this stops the ordinary double-tap on a slow
 * connection from silently burning one of only three hourly sends.
 */
export const OTP_RESEND_COOLDOWN_SECONDS = 60

// ── Stored record ────────────────────────────────────────────────────────────

export type OtpRecord = {
  /** SHA-256 of `${code}:${userId}`. The code itself is never stored. */
  hash: string
  /** E.164 number this code was issued for. Verify reads this as the number to trust. */
  phone: string
  /** Epoch ms. Used for the resend cooldown, not for expiry — the store's TTL owns expiry. */
  issuedAt: number
}

/**
 * The store, split so the attempt counter can be decremented **atomically**.
 *
 * An earlier version kept `attemptsLeft` inside the record and did
 * get → compare → set(attemptsLeft − 1). Against Upstash those are separate REST
 * round-trips with no atomicity, so N concurrent wrong guesses all read the same
 * count, all write count−1, and the three-guess limit never destroys the code.
 * The `otp_verify` limiter (10/hr, fail-closed) still bounds total guesses, so it
 * was never a practical brute-force break — but the per-code counter advertised
 * a guarantee it could not hold under concurrency.
 *
 * The counter now lives in its own key, decremented with a single atomic
 * operation (`DECR` on Upstash), so two concurrent misses genuinely consume two
 * attempts. Issue-time writes the record and the counter together under the same
 * TTL; expiry drops both.
 */
export type OtpStore = {
  read(userId: string): Promise<OtpRecord | null>
  issue(userId: string, record: OtpRecord, attempts: number, ttlSeconds: number): Promise<void>
  /** Atomic decrement. Returns the remaining count (may be ≤ 0), or null if no counter exists. */
  spendAttempt(userId: string): Promise<number | null>
  clear(userId: string): Promise<void>
  /** True when the backing store is reachable. A missing store must not fail open. */
  isConfigured(): boolean
}

export type OtpSender = {
  isConfigured(): boolean
  /** Returns false on a delivery failure; the caller must not claim the code was sent. */
  send(phone: string, code: string): Promise<boolean>
}

// ── Code generation and comparison ───────────────────────────────────────────

/**
 * A six-digit code from a CSPRNG.
 *
 * `randomInt` and not `Math.random()`: the latter is seeded, predictable, and
 * shared process-wide, so codes minted from it are guessable from other codes.
 * The range starts at 100000 so the code is always six digits — a leading zero
 * dropped by a client's number coercion would make a valid code unenterable.
 */
export function generateOtp(): string {
  return String(randomInt(100_000, 1_000_000))
}

/**
 * Salted with the user id, so an identical code issued to two people produces
 * two different hashes. Without it, a stolen store would let an attacker match
 * hashes across users and learn that two accounts hold the same code.
 */
export function hashOtp(code: string, userId: string): string {
  return createHash('sha256').update(`${code}:${userId}`).digest('hex')
}

/**
 * Constant-time comparison.
 *
 * A `===` on the hashes leaks, through timing, how many leading characters
 * matched — which turns a 10^6 search into a digit-at-a-time walk. The length
 * check first is required because `timingSafeEqual` throws on a length mismatch;
 * lengths are both 64 here, so nothing is leaked by comparing them.
 */
export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

// ── Phone normalisation ──────────────────────────────────────────────────────

/**
 * Normalises a Trinidad & Tobago number to E.164, or returns null.
 *
 * Accepts the shapes people actually type — `868 355 2214`, `(868) 355-2214`,
 * `+1 868 355 2214`, `18683552214` — and rejects everything else. Returning null
 * rather than a best guess matters: a wrongly "corrected" number sends someone
 * else's verification code to a stranger.
 */
export function normaliseTtPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '')

  // 868XXXXXXX (10) or 1868XXXXXXX (11).
  const national =
    digits.length === 10 && digits.startsWith('868')
      ? digits
      : digits.length === 11 && digits.startsWith('1868')
        ? digits.slice(1)
        : null

  if (!national) return null

  // T&T mobile exchanges start 2–4 after the area code; a landline cannot
  // receive a WhatsApp message, so accepting one guarantees a silent failure.
  const exchange = national.charAt(3)
  if (!['2', '3', '4'].includes(exchange)) return null

  return `+1${national}`
}

// ── Upstash-backed store ─────────────────────────────────────────────────────

function codeKey(userId: string): string {
  return `tl:otp:${userId}`
}

function attemptsKey(userId: string): string {
  return `tl:otp:att:${userId}`
}

function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

let cachedRedis: import('@upstash/redis').Redis | undefined

async function redis() {
  if (!cachedRedis) {
    const { Redis } = await import('@upstash/redis')
    cachedRedis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL as string,
      token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
    })
  }
  return cachedRedis
}

export const upstashOtpStore: OtpStore = {
  isConfigured: upstashConfigured,

  async read(userId) {
    const client = await redis()
    const raw = await client.get<OtpRecord>(codeKey(userId))
    return raw ?? null
  },

  async issue(userId, record, attempts, ttlSeconds) {
    const client = await redis()
    // Both keys under the same TTL. Not wrapped in one transaction because the
    // failure mode of a partial write is benign: a code with no counter reads as
    // exhausted on first miss (DECR of a missing key returns −1), which fails
    // safe rather than granting unlimited tries.
    await Promise.all([
      client.set(codeKey(userId), record, { ex: ttlSeconds }),
      client.set(attemptsKey(userId), attempts, { ex: ttlSeconds }),
    ])
  },

  async spendAttempt(userId) {
    const client = await redis()
    // DECR is atomic. A missing key decrements from 0 to −1, which the caller
    // treats as exhausted — safe.
    return client.decr(attemptsKey(userId))
  },

  async clear(userId) {
    const client = await redis()
    await Promise.all([client.del(codeKey(userId)), client.del(attemptsKey(userId))])
  },
}

// ── WhatsApp sender ──────────────────────────────────────────────────────────

/**
 * Delivery over the WhatsApp Business API.
 *
 * The message deliberately does not name the platform's action ("confirm your
 * payout account", say) — a verification message is a phishing template if it
 * tells the reader what the code authorises. It states the code, its lifetime,
 * and that it must not be shared.
 */
export const whatsappOtpSender: OtpSender = {
  isConfigured() {
    return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN)
  },

  async send(phone, code) {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const token = process.env.WHATSAPP_ACCESS_TOKEN
    if (!phoneNumberId || !token) return false

    try {
      const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: {
            body:
              `Your TradeLynq verification code is ${code}. ` +
              `It expires in 10 minutes. Do not share this code with anyone.`,
          },
        }),
      })

      if (!response.ok) {
        // Body deliberately not logged: a WhatsApp API error echoes the
        // recipient's number, and this log is not the place to accumulate them.
        logger.error('otp:whatsapp_send_failed', { status: response.status })
        return false
      }

      return true
    } catch (error) {
      logger.error('otp:whatsapp_send_threw', {
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  },
}

// ── Verification ─────────────────────────────────────────────────────────────

export type VerifyOutcome =
  | { status: 'verified'; phone: string }
  | { status: 'no_code' }
  | { status: 'wrong'; attemptsLeft: number }
  | { status: 'exhausted' }

/**
 * Checks a submitted code against the stored hash.
 *
 * Two ordering rules, both the result of an adversarial review:
 *
 *  1. **A correct code is NOT consumed here.** It returns `verified` with the
 *     number to trust and leaves the record in place, so the caller can persist
 *     `phone_verified` FIRST and clear the code only once that write succeeds. A
 *     code deleted before the flag is written would strand a user who did
 *     everything right behind a transient database blip — their one code spent,
 *     still unverified, forced to burn one of three hourly sends.
 *  2. **A wrong guess decrements atomically.** `spendAttempt` is a single atomic
 *     operation, so concurrent misses genuinely each cost an attempt rather than
 *     all reading the same count.
 *
 * The verified number is returned rather than assumed to have been written at
 * send time: `send-otp`'s profile write is best-effort, and trust state must not
 * depend on it having landed. Verify owns the number and the flag together.
 */
export async function verifyOtp(
  store: OtpStore,
  userId: string,
  submitted: string
): Promise<VerifyOutcome> {
  const record = await store.read(userId)
  if (!record) return { status: 'no_code' }

  if (hashesMatch(record.hash, hashOtp(submitted, userId))) {
    return { status: 'verified', phone: record.phone }
  }

  const remaining = await store.spendAttempt(userId)

  if (remaining === null || remaining <= 0) {
    // Destroyed rather than left to expire: a code that has survived its
    // attempts is a code someone is working on.
    await store.clear(userId)
    return { status: 'exhausted' }
  }

  return { status: 'wrong', attemptsLeft: remaining }
}
