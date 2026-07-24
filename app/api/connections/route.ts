/**
 * POST /api/connections (playbook S083, pack api-marketplace §3, flow v2/08 §8.1)
 *
 * The contact reveal — "the platform's signature sequence". A customer asks for
 * a professional's contact details; the immutable connection row IS the grant.
 * Contact data is API-redacted until this route verifies the reveal (D13) — the
 * client never receives a number to blur.
 *
 * The client does not pre-compute gate state: it POSTs and branches on the
 * taxonomy code, so the error codes returned here ARE the state machine
 * (LEGAL_ACCEPTANCE_REQUIRED → inline modal · KYC_REQUIRED → gate sheet ·
 * NOT_FOUND → listing-unavailable state · 200 → contact rendered).
 *
 * Gate states (pack §3): counts 0/1 → free reveal · count 2 + unverified →
 * KYC_REQUIRED · verified → unlimited. Duplicate reveal of the same
 * professional → 200 with `existing: true` — a no-op that never burns the
 * counter.
 *
 * FLAGS (pack deltas, logged not silently resolved):
 *  - The pack's request body is `{ "worker_id": … }` — V1 naming. The shipped
 *    enquiries route already takes `professional_id`, so this route follows the
 *    codebase precedent.
 *  - The pack's KYC_REQUIRED details are `{ connection_count, verify_url }`;
 *    the compile-enforced taxonomy (`lib/api/errors.ts`) carries
 *    `{ reason, connectionsUsed }`. The taxonomy is the client contract and
 *    wins; the client derives the verify destination from the code.
 *  - `contact: { phone, whatsapp }` in the 200 is a V2 addition beyond the pack
 *    so the rail renders instantly — server-verified, because the connection
 *    row now exists.
 *
 * The DB trigger `enforce_connection_gate` (migration 20260719000007) is the
 * real boundary; the TypeScript gate below is the good-error optimisation. A
 * caller who races past the TS check still hits the trigger, mapped back to
 * KYC_REQUIRED here.
 */
import { z } from 'zod'
import {
  requireCustomer,
  ensureLegalAcceptances,
  requireCustomerConnectionGate,
  CUSTOMER_CONTACT_LEGAL,
} from '@/lib/access/api'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import { logActivity, flushAnalytics } from '@/lib/analytics/server'
import type { KycState } from '@/lib/analytics/events'

const bodySchema = z.object({
  professional_id: z.string().uuid(),
})

/** Maps the stored kyc_status onto the analytics dictionary's KycState. */
function toKycState(status: string | null | undefined): KycState {
  switch (status) {
    case 'verified':
      return 'verified'
    case 'rejected':
      return 'rejected'
    case 'pending':
    case 'submitted':
      return 'pending'
    default:
      return 'not_required'
  }
}

export async function POST(request: Request) {
  // 1. Rate-limit — a reveal notifies nobody, but an unbounded loop harvests
  // contact numbers. Own limiter key: `enquiry` (3/60) is sized for
  // notification spam, which this is not.
  const limit = await checkRateLimit('connection', identifierFrom(request))
  if (!limit.ok) return limit.response

  // 2. Session — must be a customer.
  const ctx = await requireCustomer(request)
  if (!ctx.ok) return ctx.response

  // 3. Legal acceptances (403 LEGAL_ACCEPTANCE_REQUIRED with the missing set —
  // the client renders the inline modal and retries). Canon order: legal sits
  // directly after auth, before the body is even parsed — it depends only on
  // the session, and a caller who owes an acceptance learns nothing else first.
  const legal = await ensureLegalAcceptances(ctx, CUSTOMER_CONTACT_LEGAL)
  if (!legal.ok) return legal.response

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
  const { professional_id } = parsed.data

  // 4. The professional must exist and be active. RLS only returns a row for an
  // ACTIVE public listing, so a null here is the flow's "404-equivalent with
  // search suggestion" (v2/08 §8.1) — indistinguishable from never-existed, no
  // status leakage.
  const { data: professional, error: proError } = await ctx.supabase
    .from('professional_profiles')
    .select('id')
    .eq('id', professional_id)
    .maybeSingle()

  if (proError) {
    logger.error('connection:professional_lookup_failed', { code: proError.code })
    return err('INTERNAL')
  }
  if (!professional) {
    return err('NOT_FOUND', { resource: 'professional' })
  }

  // 5. Connection gate — two free contacts, then identity verification.
  const gate = await requireCustomerConnectionGate(ctx, professional_id)
  if (!gate.ok) {
    // `kyc_prompted` is a server-layer event (EMISSION_LAYER) — emitted here,
    // where the gate actually refused, not trusted from the client.
    const body = (await gate.response
      .clone()
      .json()
      .catch(() => null)) as { code?: string } | null
    if (body?.code === 'KYC_REQUIRED') {
      await logActivity('kyc_prompted', {}, { userId: ctx.userId })
      await flushAnalytics()
    }
    return gate.response
  }

  // 6. Write the connection. The row is immutable and unique per
  // (customer, professional); the BEFORE INSERT trigger re-checks the gate at
  // the boundary, and the AFTER trigger recounts connection_count.
  const { data: created, error: writeError } = await ctx.supabase
    .from('connections')
    .insert({ customer_id: ctx.userId, professional_id })
    .select('id')
    .single()

  let connectionId: string | null = created?.id ?? null
  let existing = false

  if (writeError) {
    if (writeError.code === '23505') {
      // Unique-pair violation: the duplicate reveal. A no-op that never burns
      // the counter — return the existing row rather than an error.
      existing = true
      const { data: pair } = await ctx.supabase
        .from('connections')
        .select('id')
        .eq('customer_id', ctx.userId)
        .eq('professional_id', professional_id)
        .maybeSingle()
      connectionId = pair?.id ?? null
    } else if (writeError.code === '42501') {
      // The DB gate (the real boundary) refused — the TS gate raced. Same
      // answer as step 5, from the layer that cannot be raced.
      const { data: profile } = await ctx.supabase
        .from('customer_profiles')
        .select('connection_count, kyc_status')
        .eq('user_id', ctx.userId)
        .maybeSingle()
      await logActivity('kyc_prompted', {}, { userId: ctx.userId })
      await flushAnalytics()
      return err('KYC_REQUIRED', {
        reason: 'connection_limit_reached',
        connectionsUsed: profile?.connection_count ?? 2,
      })
    } else {
      logger.error('connection:create_failed', {
        professionalId: professional_id,
        code: writeError.code,
      })
      return err('INTERNAL')
    }
  }

  // 7. Fresh count — the trigger recomputed it; read it back rather than
  // incrementing client-side arithmetic into the response.
  const { data: profile } = await ctx.supabase
    .from('customer_profiles')
    .select('connection_count, kyc_status')
    .eq('user_id', ctx.userId)
    .maybeSingle()
  const connectionCount = profile?.connection_count ?? 0

  // 8. The contact — selected by explicit column list ONLY now the connection
  // row exists (D13: redaction is the column list, migration 20260719000005).
  const { data: contactRow, error: contactError } = await ctx.supabase
    .from('professional_profiles')
    .select('contact_phone, contact_whatsapp')
    .eq('id', professional_id)
    .maybeSingle()

  if (contactError) {
    logger.error('connection:contact_read_failed', {
      professionalId: professional_id,
      code: contactError.code,
    })
  }

  if (!existing) {
    // `reveal_completed` is server truth (EMISSION_LAYER) — the funnel's
    // reveal_success step.
    await logActivity(
      'reveal_completed',
      {
        professional_id,
        connection_number: connectionCount,
        kyc_state: toKycState(profile?.kyc_status),
      },
      { userId: ctx.userId, entityType: 'connection', entityId: connectionId ?? undefined }
    )
    await flushAnalytics()
    logger.info('connection:created', { connectionId, professionalId: professional_id })
  }

  return ok({
    success: true,
    existing,
    connectionId,
    connection_count: connectionCount,
    kyc_required: false,
    // V2 addition beyond the pack (flagged in the header comment): the reveal's
    // whole point, server-verified by the row that now exists.
    contact: {
      phone: contactRow?.contact_phone ?? null,
      whatsapp: contactRow?.contact_whatsapp ?? null,
    },
  })
}
