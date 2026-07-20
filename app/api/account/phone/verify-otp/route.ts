/**
 * POST /api/account/phone/verify-otp (playbook S056, pack `api-marketplace.md` §1.2)
 *
 * Body: `{ code: string }` → 200 `{ verified: true }`
 * Wrong code: 422 `INVALID_INPUT` with `details.attempts_left`.
 *
 * Three tries per issued code, then the code is destroyed. The pack's example
 * shows `attempts_left: 2` after the first miss, which fixes it at three.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/access/api'
import { err, ok } from '@/lib/api/errors'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/utils/logger'
import { upstashOtpStore, verifyOtp, type OtpStore } from '@/lib/otp'

const bodySchema = z.object({
  // Exactly six digits. Length alone is not enough: a non-numeric body would
  // still hash and compare, wasting one of only three attempts on input that
  // could never have been a code.
  code: z.string().regex(/^\d{6}$/, 'Enter the six-digit code.'),
})

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
 * The handler, with its store injectable. `POST` is the one-argument wrapper the
 * framework sees — a Next.js 16 route's second parameter is constrained to
 * `{ params }`, so the store cannot arrive as a second route argument.
 */
export async function handleVerifyOtp(request: Request, deps: { store?: OtpStore } = {}) {
  const store = deps.store ?? upstashOtpStore

  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const limit = await checkRateLimit('otp_verify', identifierFrom(request, auth.userId))
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

  if (!store.isConfigured()) {
    logger.error('otp:store_unconfigured')
    return unavailable()
  }

  const outcome = await verifyOtp(store, auth.userId, parsed.data.code)

  // `no_code` and `exhausted` share one message on purpose. Distinct strings
  // leak, to the account holder, whether a code currently exists or is under
  // attack — contained (the store is keyed on this user) but volunteered state
  // with no upside.
  if (outcome.status === 'no_code' || outcome.status === 'exhausted') {
    return err('INVALID_INPUT', {
      fieldErrors: { code: ['That code is no longer valid. Ask for a new one.'] },
      formErrors: [],
      attempts_left: 0,
    })
  }

  if (outcome.status === 'wrong') {
    return err('INVALID_INPUT', {
      fieldErrors: {
        code: [
          `Incorrect code. ${outcome.attemptsLeft} ${
            outcome.attemptsLeft === 1 ? 'attempt' : 'attempts'
          } left.`,
        ],
      },
      formErrors: [],
      attempts_left: outcome.attemptsLeft,
    })
  }

  // Persist BEFORE consuming. verifyOtp deliberately left the code in place, so
  // if this write fails the user retries with the SAME code — no stranding, no
  // wasted send. Only a landed write clears it.
  //
  // Both fields move together, sourced from the verified record: verify is the
  // sole authority for the trusted number, so `phone_verified: true` can never
  // attach to a stale `phone_number`.
  //
  // Admin client: this is column-guarded trust state a user may not assert about
  // themselves.
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ phone_number: outcome.phone, phone_verified: true })
    .eq('id', auth.userId)

  if (error) {
    logger.error('otp:verify_persist_failed', { userId: auth.userId, code: error.code })
    // Code intact, so an honest failure here is retryable with the same code.
    return err('INTERNAL')
  }

  // Single-use: cleared only now that the flag is durably set. A concurrent
  // double-submit that read the record before this clear also writes the same
  // idempotent update and returns success — which is the correct answer.
  await store.clear(auth.userId)

  return ok({ verified: true })
}

export function POST(request: Request) {
  return handleVerifyOtp(request)
}
