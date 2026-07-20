/**
 * The canonical API error taxonomy (v2/09 §9.1).
 *
 * Every error response on this platform is `{ code, error, details? }` and every
 * `code` comes from this module. There are no ad-hoc error literals in `app/api` —
 * CI greps for them.
 *
 * Two properties this module exists to guarantee:
 *
 * 1. **Every 4xx is actionable.** The spec requires the response to carry what the
 *    client needs to render the fix. That is enforced by the type system here:
 *    each code declares its own `details` shape, so returning
 *    `LEGAL_ACCEPTANCE_REQUIRED` without the missing-documents list, or
 *    `INSUFFICIENT_CREDITS` without the balance, is a compile error rather than a
 *    runtime disappointment.
 *
 * 2. **No raw database errors go outbound.** `INTERNAL` is deliberately opaque and
 *    takes no details. Diagnostic context goes to the logger, never to the client —
 *    Postgres error text leaks schema shape.
 *
 * UI copy is keyed off `code`, never off `error`. The `error` string is a developer
 * fallback and a log line; it is not what the user reads. This is what lets the same
 * gate read identically on web and in both mobile apps.
 */
import { NextResponse } from 'next/server'

// ── The taxonomy ─────────────────────────────────────────────────────────────

/**
 * The details payload each code must carry.
 *
 * `null` means the code takes no details. Anything else is required at the call site.
 */
type ErrorDetails = {
  /** No valid session. The client should send the user to sign in. */
  UNAUTHENTICATED: null

  /** Authenticated, but the wrong role for this resource. */
  FORBIDDEN_ROLE: { requiredRoles: readonly string[]; currentRole: string | null }

  /** The feature exists but the subscription tier does not include it. */
  TIER_UPGRADE_REQUIRED: {
    feature: string
    currentTier: string | null
    /** The lowest tier that unlocks the feature — the client renders the upgrade CTA from this. */
    requiredTier: string
  }

  /** Legal documents must be accepted before this action proceeds. */
  LEGAL_ACCEPTANCE_REQUIRED: {
    /** Document slugs still outstanding, e.g. ['terms-of-service', 'privacy-policy']. */
    missingDocuments: readonly string[]
  }

  /** Identity verification required — the connection gate past its free allowance. */
  KYC_REQUIRED: {
    reason: 'connection_limit_reached' | 'verification_pending' | 'verification_rejected'
    /** Free connections already consumed, so the UI can explain the gate honestly. */
    connectionsUsed?: number
  }

  /** Input failed schema validation. Carries the zod flatten output verbatim. */
  INVALID_INPUT: {
    fieldErrors: Record<string, string[] | undefined>
    formErrors: string[]
    /**
     * Remaining tries before the value being checked is destroyed — currently
     * only phone OTP verification (`details/api-marketplace.md` §1.2).
     *
     * Optional so every existing zod-shaped call site stays valid.
     *
     * FLAG (S056): snake_case here contradicts the camelCase used by every
     * other member of this taxonomy (`retryAfterSeconds`, `requiredRoles`).
     * The API pack specifies `attempts_left` verbatim and the pack is the
     * client contract, so the wire format wins over local consistency — but the
     * two conventions should be reconciled platform-wide rather than left to
     * accumulate. Detail files outrank chapters; nothing yet rules on casing.
     */
    attempts_left?: number
  }

  /** The resource does not exist, or is not visible to this caller. */
  NOT_FOUND: { resource: string }

  /** The resource exists but is in a state that forbids the attempted transition. */
  CONFLICT_STATE: {
    resource: string
    currentState: string
    attemptedTransition: string
  }

  /** An equivalent resource already exists — deduplication, not a race. */
  DUPLICATE: {
    resource: string
    existingId?: string
    /** Present when the duplicate is time-windowed, e.g. the 60s enquiry dedupe. */
    retryAfterSeconds?: number
  }

  /** Rate limit exceeded. */
  RATE_LIMITED: {
    retryAfterSeconds: number
    /** Which named limiter tripped — for support and for the client's message. */
    limiter: string
  }

  /** Not enough tool credits for the requested operation. */
  INSUFFICIENT_CREDITS: {
    balance: number
    required: number
    /** Where to buy more — the client renders this as the CTA. */
    bundleUrl: string
  }

  /** Payment is required or has failed — subscription lapsed past its grace ladder. */
  PAYMENT_REQUIRED: {
    reason: 'subscription_inactive' | 'payment_failed' | 'grace_expired'
    /** Stripe portal or checkout URL, so the client can offer the fix directly. */
    resolveUrl?: string
  }

  /** Something broke on our side. Deliberately opaque — details go to the logger. */
  INTERNAL: null
}

export type ApiErrorCode = keyof ErrorDetails

/** HTTP status per code. */
const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN_ROLE: 403,
  TIER_UPGRADE_REQUIRED: 403,
  LEGAL_ACCEPTANCE_REQUIRED: 403,
  KYC_REQUIRED: 403,
  INVALID_INPUT: 422,
  NOT_FOUND: 404,
  CONFLICT_STATE: 409,
  DUPLICATE: 409,
  RATE_LIMITED: 429,
  // Spec calls this "402-style 403": 403 keeps it inside the normal authorisation
  // handling on the client, while the code carries the payment meaning. Using a
  // literal 402 would route it through payment-required interceptors it does not want.
  INSUFFICIENT_CREDITS: 403,
  PAYMENT_REQUIRED: 402,
  INTERNAL: 500,
}

/**
 * Developer-facing fallback messages.
 *
 * These are NOT user copy. User copy is keyed off `code` in the client's own
 * dictionary, so the same error reads correctly on web, iOS, and Android, and can be
 * translated without touching the server.
 */
const MESSAGE: Record<ApiErrorCode, string> = {
  UNAUTHENTICATED: 'Authentication required.',
  FORBIDDEN_ROLE: 'Your account role cannot access this resource.',
  TIER_UPGRADE_REQUIRED: 'This feature requires a higher subscription tier.',
  LEGAL_ACCEPTANCE_REQUIRED: 'Outstanding legal documents must be accepted first.',
  KYC_REQUIRED: 'Identity verification is required to continue.',
  INVALID_INPUT: 'The submitted data failed validation.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT_STATE: 'The resource is not in a state that allows this action.',
  DUPLICATE: 'An equivalent resource already exists.',
  RATE_LIMITED: 'Too many requests. Please try again shortly.',
  INSUFFICIENT_CREDITS: 'Not enough tool credits for this operation.',
  PAYMENT_REQUIRED: 'An active subscription is required to continue.',
  INTERNAL: 'Something went wrong on our end.',
}

// ── The response body ────────────────────────────────────────────────────────

export type ApiErrorBody<C extends ApiErrorCode = ApiErrorCode> = {
  code: C
  error: string
  details?: ErrorDetails[C] extends null ? never : ErrorDetails[C]
}

/**
 * Codes that carry no details — callable as `err('INTERNAL')`.
 */
type CodesWithoutDetails = {
  [K in ApiErrorCode]: ErrorDetails[K] extends null ? K : never
}[ApiErrorCode]

/**
 * Codes that require details — the compiler will not let you omit them.
 */
type CodesWithDetails = Exclude<ApiErrorCode, CodesWithoutDetails>

// ── The constructor ──────────────────────────────────────────────────────────

export function err(code: CodesWithoutDetails, message?: string): NextResponse
export function err<C extends CodesWithDetails>(
  code: C,
  details: ErrorDetails[C],
  message?: string
): NextResponse
export function err(
  code: ApiErrorCode,
  detailsOrMessage?: unknown,
  maybeMessage?: string
): NextResponse {
  const takesDetails = typeof detailsOrMessage === 'object' && detailsOrMessage !== null
  const details = takesDetails ? detailsOrMessage : undefined
  const message =
    (takesDetails ? maybeMessage : (detailsOrMessage as string | undefined)) ?? MESSAGE[code]

  const body: Record<string, unknown> = { code, error: message }
  if (details !== undefined) body.details = details

  const headers = new Headers()

  // Retry-After is part of the HTTP contract, not just the body. Clients and
  // intermediaries honour the header; only our own client reads the body.
  if (code === 'RATE_LIMITED') {
    const seconds = (details as ErrorDetails['RATE_LIMITED'] | undefined)?.retryAfterSeconds
    if (typeof seconds === 'number') headers.set('Retry-After', String(Math.ceil(seconds)))
  }

  return NextResponse.json(body, { status: STATUS[code], headers })
}

/** The HTTP status a given code maps to. Exported for tests and for the access layer. */
export function statusFor(code: ApiErrorCode): number {
  return STATUS[code]
}

/** The developer-facing fallback message for a code. */
export function messageFor(code: ApiErrorCode): string {
  return MESSAGE[code]
}

/** Every code in the taxonomy. Used by the exhaustiveness test. */
export const ERROR_CODES = Object.keys(STATUS) as readonly ApiErrorCode[]

// ── Success shape ────────────────────────────────────────────────────────────

/**
 * The success counterpart. Kept here so both halves of the response contract live
 * in one file and cannot drift apart.
 */
export function ok<T>(data: T, init?: { status?: number; headers?: HeadersInit }): NextResponse {
  return NextResponse.json({ data }, { status: init?.status ?? 200, headers: init?.headers })
}
