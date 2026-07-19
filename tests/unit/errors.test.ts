/**
 * The error taxonomy is the contract three clients depend on (web, iOS, Android).
 * These tests assert the shape of every code, so a careless edit to the taxonomy
 * breaks CI rather than breaking a mobile release two weeks later.
 */
import { describe, it, expect } from 'vitest'
import { err, ok, statusFor, messageFor, ERROR_CODES, type ApiErrorCode } from '@/lib/api/errors'

/** The taxonomy exactly as v2/09 §9.1 specifies it, with expected statuses. */
const SPEC: Record<ApiErrorCode, number> = {
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
  INSUFFICIENT_CREDITS: 403,
  PAYMENT_REQUIRED: 402,
  INTERNAL: 500,
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

describe('error taxonomy — completeness', () => {
  it('exports exactly the codes the spec defines, no more and no fewer', () => {
    expect([...ERROR_CODES].sort()).toEqual(Object.keys(SPEC).sort())
  })

  it('maps every code to the status the spec assigns it', () => {
    for (const [code, status] of Object.entries(SPEC)) {
      expect(statusFor(code as ApiErrorCode), `status for ${code}`).toBe(status)
    }
  })

  it('gives every code a non-empty fallback message', () => {
    for (const code of ERROR_CODES) {
      expect(messageFor(code).length, `message for ${code}`).toBeGreaterThan(0)
    }
  })
})

describe('error taxonomy — response shape', () => {
  it('always returns { code, error } at minimum', async () => {
    const body = await bodyOf(err('INTERNAL'))
    expect(body).toMatchObject({ code: 'INTERNAL' })
    expect(typeof body.error).toBe('string')
  })

  it('omits details entirely for codes that carry none', async () => {
    const body = await bodyOf(err('UNAUTHENTICATED'))
    expect('details' in body).toBe(false)
  })

  it('keeps INTERNAL opaque — no details channel for database errors to leak through', async () => {
    const response = err('INTERNAL')
    const body = await bodyOf(response)
    expect(body).toEqual({ code: 'INTERNAL', error: messageFor('INTERNAL') })
    expect(response.status).toBe(500)
  })

  it('accepts a message override without disturbing the code', async () => {
    const body = await bodyOf(err('NOT_FOUND', { resource: 'professional' }, 'No such professional.'))
    expect(body.code).toBe('NOT_FOUND')
    expect(body.error).toBe('No such professional.')
  })
})

describe('error taxonomy — actionable 4xx payloads', () => {
  it('LEGAL_ACCEPTANCE_REQUIRED names the outstanding documents', async () => {
    const body = await bodyOf(
      err('LEGAL_ACCEPTANCE_REQUIRED', { missingDocuments: ['terms-of-service', 'privacy-policy'] })
    )
    expect(body.details).toEqual({ missingDocuments: ['terms-of-service', 'privacy-policy'] })
  })

  it('INSUFFICIENT_CREDITS carries balance, requirement, and where to buy more', async () => {
    const body = await bodyOf(
      err('INSUFFICIENT_CREDITS', { balance: 12, required: 50, bundleUrl: '/tools/credits' })
    )
    expect(body.details).toEqual({ balance: 12, required: 50, bundleUrl: '/tools/credits' })
  })

  it('TIER_UPGRADE_REQUIRED names the feature and the tier that unlocks it', async () => {
    const body = await bodyOf(
      err('TIER_UPGRADE_REQUIRED', { feature: 'crm', currentTier: 'growth', requiredTier: 'studio' })
    )
    expect(body.details).toMatchObject({ feature: 'crm', requiredTier: 'studio' })
  })

  it('CONFLICT_STATE reports the current state and the refused transition', async () => {
    const body = await bodyOf(
      err('CONFLICT_STATE', {
        resource: 'job',
        currentState: 'completed',
        attemptedTransition: 'in_progress',
      })
    )
    expect(body.details).toMatchObject({ currentState: 'completed' })
  })

  it('INVALID_INPUT carries the zod flatten output as-is', async () => {
    const flattened = { fieldErrors: { email: ['Invalid email address'] }, formErrors: [] }
    const body = await bodyOf(err('INVALID_INPUT', flattened))
    expect(body.details).toEqual(flattened)
  })

  it('KYC_REQUIRED explains which gate was hit', async () => {
    const body = await bodyOf(
      err('KYC_REQUIRED', { reason: 'connection_limit_reached', connectionsUsed: 2 })
    )
    expect(body.details).toMatchObject({ reason: 'connection_limit_reached', connectionsUsed: 2 })
  })
})

describe('error taxonomy — HTTP semantics', () => {
  it('sets the Retry-After header on RATE_LIMITED, not only the body', () => {
    const response = err('RATE_LIMITED', { retryAfterSeconds: 42, limiter: 'auth' })
    expect(response.headers.get('Retry-After')).toBe('42')
    expect(response.status).toBe(429)
  })

  it('rounds a fractional Retry-After up — never advertises a retry that is still limited', () => {
    const response = err('RATE_LIMITED', { retryAfterSeconds: 4.2, limiter: 'search' })
    expect(response.headers.get('Retry-After')).toBe('5')
  })

  it('does not set Retry-After on codes that do not warrant it', () => {
    expect(err('INTERNAL').headers.get('Retry-After')).toBeNull()
  })
})

describe('success shape', () => {
  it('wraps payloads in { data } so success and error are never ambiguous', async () => {
    const body = await bodyOf(ok({ id: 'abc' }))
    expect(body).toEqual({ data: { id: 'abc' } })
  })

  it('defaults to 200 and honours an explicit status', () => {
    expect(ok({}).status).toBe(200)
    expect(ok({}, { status: 201 }).status).toBe(201)
  })
})
