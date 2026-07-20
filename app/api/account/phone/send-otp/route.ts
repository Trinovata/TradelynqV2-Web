/**
 * POST /api/account/phone/send-otp (playbook S056, pack `api-marketplace.md` §1.2)
 *
 * Body: `{ phone_number: string }` → 200 `{ sent: true, expires_in: 600 }`
 *
 * Route order: auth → rate-limit → zod → work.
 *
 * This is a DELIBERATE, documented departure from the canon's
 * "rate-limit → auth" ordering. The `otp_send` budget is per-account (3/hour),
 * so the limiter is keyed on `userId` — which does not exist until auth has run.
 * Auth therefore has to precede it. That is the right trade for these routes:
 * there is no anonymous OTP path, so nothing needs limiting before a session
 * exists, and a per-account budget is what the pack specifies. `otp_send` is
 * fail-closed, so if the limit cannot be verified no message is sent.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/access/api'
import { err, ok } from '@/lib/api/errors'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { logger } from '@/lib/utils/logger'
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  generateOtp,
  hashOtp,
  normaliseTtPhone,
  upstashOtpStore,
  whatsappOtpSender,
  type OtpSender,
  type OtpStore,
} from '@/lib/otp'

const bodySchema = z.object({
  phone_number: z.string().min(7).max(24),
})

/** 503 for a dependency we cannot reach. Never 200 — the caller would wait for a code that is not coming. */
function unavailable() {
  return NextResponse.json(
    {
      code: 'INTERNAL',
      error: 'Phone verification is unavailable right now. Please try again shortly.',
    },
    { status: 503 }
  )
}

/**
 * The handler, with its dependencies injectable.
 *
 * Kept separate from `POST` because a Next.js 16 route handler's second parameter
 * is constrained to `{ params }` and the build type-checks that signature — so
 * the store and sender cannot ride in as a second route argument. Tests call
 * this directly; `POST` is the one-argument wrapper the framework sees.
 */
export async function handleSendOtp(
  request: Request,
  deps: { store?: OtpStore; sender?: OtpSender } = {}
) {
  const store = deps.store ?? upstashOtpStore
  const sender = deps.sender ?? whatsappOtpSender

  // Auth precedes the limiter here — see the header comment. The limiter is
  // keyed on the user, not the IP, so the send budget belongs to the account and
  // one household's shared address cannot exhaust it for everyone on it.
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const limit = await checkRateLimit('otp_send', identifierFrom(request, auth.userId))
  if (!limit.ok) return limit.response

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return err('INVALID_INPUT', { fieldErrors: {}, formErrors: ['Send a JSON body.'] })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return err('INVALID_INPUT', { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors })
  }

  const phone = normaliseTtPhone(parsed.data.phone_number)
  if (!phone) {
    return err('INVALID_INPUT', {
      fieldErrors: {
        phone_number: ['Enter a Trinidad & Tobago mobile number, for example 868 355 2214.'],
      },
      formErrors: [],
    })
  }

  if (!store.isConfigured() || !sender.isConfigured()) {
    logger.error('otp:dependency_unconfigured', {
      store: store.isConfigured(),
      sender: sender.isConfigured(),
    })
    return unavailable()
  }

  // Cooldown, under the hourly limiter. Stops a double-tap from burning one of
  // only three hourly sends without telling the user why they are stuck.
  const existing = await store.read(auth.userId)
  if (existing && Date.now() - existing.issuedAt < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
    const waitSeconds = Math.ceil(
      (OTP_RESEND_COOLDOWN_SECONDS * 1000 - (Date.now() - existing.issuedAt)) / 1000
    )
    return err(
      'RATE_LIMITED',
      { retryAfterSeconds: waitSeconds, limiter: 'otp_send' },
      `A code was just sent. Wait ${waitSeconds} seconds before asking for another.`
    )
  }

  const code = generateOtp()

  // Stored BEFORE sending. The other order can deliver a code the store never
  // recorded, which the user then cannot use. Issue writes the code and the
  // attempt counter together.
  await store.issue(
    auth.userId,
    { hash: hashOtp(code, auth.userId), phone, issuedAt: Date.now() },
    OTP_MAX_ATTEMPTS,
    OTP_TTL_SECONDS
  )

  const sent = await sender.send(phone, code)
  if (!sent) {
    // Cleared, so a failed send does not leave a live code the user never saw
    // occupying their cooldown window.
    await store.clear(auth.userId)
    return unavailable()
  }

  // The number is deliberately NOT written to the profile here. Trust state —
  // `phone_number` and `phone_verified` together — is owned entirely by verify,
  // sourced from the record it verifies. A best-effort write here that then
  // failed silently could leave `phone_verified: true` sitting against the
  // wrong number (a HIGH finding in review); the number lives in the OTP record
  // until verify promotes it.
  return ok({ sent: true, expires_in: OTP_TTL_SECONDS })
}

export function POST(request: Request) {
  return handleSendOtp(request)
}
