/**
 * POST /api/enquiries/create (playbook S085, pack api-marketplace §4.1)
 *
 * The moment the marketplace transacts: a customer reaches a professional. This
 * is the write that fills the professional's inbox — the other half of the loop
 * whose read side (the inbox + accept/decline) already exists.
 *
 * Body: `{ professional_id, description, preferred_date?, contact_preference }`
 * → 201 `{ enquiry }`.
 *
 * Gate order, per the pack: rate-limit → session (customer) → professional is
 * accepting → legal acceptances → connection gate (2 free, then KYC) →
 * validation → 60s duplicate guard → write. Sending an enquiry also ENSURES a
 * connection (this contact is now on the record and counts against the gate).
 * The DB INSERT guard forces the enquiry to a clean `pending` with an empty case
 * log, so nothing here has to trust the client for status.
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

const bodySchema = z.object({
  professional_id: z.string().uuid(),
  // D54: 20–1,000 characters. Enough to describe a job, not an essay.
  description: z.string().trim().min(20).max(1000),
  preferred_date: z.string().date().optional(),
  contact_preference: z.enum(['whatsapp', 'call', 'email']),
})

export async function POST(request: Request) {
  // 1. Rate-limit — an enquiry is a notification to another person; cap the spray.
  const limit = await checkRateLimit('enquiry', identifierFrom(request))
  if (!limit.ok) return limit.response

  // 2. Session — must be a customer.
  const ctx = await requireCustomer(request)
  if (!ctx.ok) return ctx.response

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
  const { professional_id, description, preferred_date, contact_preference } = parsed.data

  // 3. The professional must exist and be accepting. RLS only returns a row for an
  // ACTIVE public listing, so a null here means "not reachable" either way.
  // Contact columns are selected here but returned ONLY in the 201, after every
  // gate has passed and the connection is ensured — at which point the reveal is
  // server-verified (D13). They never appear on an error path.
  const { data: professional, error: proError } = await ctx.supabase
    .from('professional_profiles')
    .select('id, category_id, owner_name, business_name, contact_phone, contact_whatsapp')
    .eq('id', professional_id)
    .maybeSingle()

  if (proError) {
    logger.error('enquiry:professional_lookup_failed', { code: proError.code })
    return err('INTERNAL')
  }
  if (!professional) {
    return err(
      'CONFLICT_STATE',
      { resource: 'enquiry', currentState: 'unavailable', attemptedTransition: 'create' },
      "This professional isn't taking new enquiries right now."
    )
  }
  const firstName = professional.owner_name?.split(' ')[0] ?? professional.business_name

  // 4. Legal acceptances (403 LEGAL_ACCEPTANCE_REQUIRED with the missing set).
  const legal = await ensureLegalAcceptances(ctx, CUSTOMER_CONTACT_LEGAL)
  if (!legal.ok) return legal.response

  // 5. Connection gate — two free contacts, then identity verification.
  const gate = await requireCustomerConnectionGate(ctx, professional_id)
  if (!gate.ok) return gate.response

  // 6. Duplicate guard — an accidental double-tap within 60s is not two enquiries.
  const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString()
  const { count: recent } = await ctx.supabase
    .from('job_enquiries')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', ctx.userId)
    .eq('professional_id', professional_id)
    .gte('created_at', sixtySecondsAgo)
  if ((recent ?? 0) > 0) {
    return err(
      'DUPLICATE',
      { resource: 'enquiry' },
      `You've just sent this — give ${firstName} a moment to reply.`
    )
  }

  // 7. Write the enquiry. The BEFORE INSERT guard forces status=pending and an
  // empty case log; category is inherited from the professional's listing.
  const { data: enquiry, error: writeError } = await ctx.supabase
    .from('job_enquiries')
    .insert({
      customer_id: ctx.userId,
      professional_id,
      description,
      preferred_date: preferred_date ?? null,
      contact_preference,
      category_id: professional.category_id,
      source: 'platform',
    })
    .select('id, status, created_at')
    .single()

  if (writeError) {
    logger.error('enquiry:create_failed', {
      professionalId: professional_id,
      code: writeError.code,
    })
    return err('INTERNAL')
  }

  // 8. Ensure the connection — this contact is now on the record and counts
  // against the free-contact gate. Idempotent: a returning customer already has
  // one, and the unique (customer, professional) pair absorbs the repeat.
  const { error: connError } = await ctx.supabase
    .from('connections')
    .upsert(
      { customer_id: ctx.userId, professional_id },
      { onConflict: 'customer_id,professional_id', ignoreDuplicates: true }
    )
  if (connError) {
    // The enquiry is written and is the source of truth; a missed connection row
    // is self-healing (the count is recomputed by trigger). Log, don't fail.
    logger.error('enquiry:connection_ensure_failed', {
      professionalId: professional_id,
      code: connError.code,
    })
  }

  // TODO(S135): notify the professional through the dispatcher (email/WhatsApp/push)
  // and emit `enquiry_created`.
  logger.info('enquiry:created', { enquiryId: enquiry.id, professionalId: professional_id })

  // FLAG (V2 addition beyond pack §4.1): `contact` rides along with the 201 so
  // the success state can offer "Chat on WhatsApp now" (copy-public.md §5.11)
  // and the rail can flip to revealed without a second round trip. Safe by 8.1's
  // own rule — the enquiry auto-created the connection ("one gate, not two"),
  // so the reveal is now server-verified.
  return ok(
    {
      enquiry,
      contact: {
        phone: professional.contact_phone ?? null,
        whatsapp: professional.contact_whatsapp ?? null,
      },
    },
    { status: 201 }
  )
}
