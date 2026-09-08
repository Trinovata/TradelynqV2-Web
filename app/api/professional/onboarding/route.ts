/**
 * PUT /api/professional/onboarding (playbook S107, spec `v2/05 §5.2`).
 *
 * Saves the onboarding draft. Called on step transitions and on the wizard's
 * debounced autosave, so it must be cheap, idempotent, and safe to run against
 * a half-typed form — hence every field optional and no completeness checks
 * here. Completeness is `publish`'s job.
 *
 * Route order: rate-limit -> auth(role) -> zod -> RLS write.
 *
 * ## Why this route cannot publish anything
 *
 * It writes `listing_status` exactly once, at creation, and the value is always
 * `draft` (the DB's `guard_professional_insert` forces it regardless). Updates
 * never touch the column, and `guard_professional_privileged_columns` would
 * refuse anything but `draft -> pending_review` if they tried. Three layers,
 * same as the storefront editor: allow-list schema, RLS row scope, DB guard.
 *
 * ## Why a draft row exists at all before publish
 *
 * The 24h abandonment nudge (`v2/08 §8.6`) needs to know who started and how
 * far they got. localStorage cannot tell the server that, so the row is created
 * on the first save even when it is nearly empty — a `draft` row is invisible
 * to every public query (`professional_profiles_select_public` requires
 * `active`), so an empty one costs nothing but makes the nudge possible.
 */
import { requireRole } from '@/lib/access/api'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import { draftSchema } from '@/lib/professional/onboarding'
import { parseCredentials } from '@/lib/professional/onboarding-server'

/** Years of experience is persisted as a start date so it ages by itself. */
function tenureFromYears(years: number | null | undefined): string | null | undefined {
  if (years === undefined) return undefined
  if (years === null) return null
  return `${new Date().getUTCFullYear() - years}-01-01`
}

export async function PUT(request: Request) {
  const limit = await checkRateLimit('api', identifierFrom(request))
  if (!limit.ok) return limit.response

  // `requireRole`, not `requireProfessional`: the professional profile is the
  // very thing this route creates, so requiring it would make onboarding
  // impossible — the chicken-and-egg that dead-ended the signup flow.
  const access = await requireRole(['professional'], request)
  if (!access.ok) return access.response

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return err('INVALID_INPUT', { fieldErrors: {}, formErrors: ['Send a JSON body.'] })
  }

  const parsed = draftSchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return err('INVALID_INPUT', { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors })
  }
  const body = parsed.data

  const { data: existing, error: readError } = await access.supabase
    .from('professional_profiles')
    .select('id, listing_status, onboarding_step, certifications')
    .eq('user_id', access.userId)
    .maybeSingle()

  if (readError) {
    logger.error('onboarding:read_failed', { userId: access.userId, code: readError.code })
    return err('INTERNAL')
  }

  // A storefront that has left draft is edited through the storefront editor,
  // which has its own narrower allow-list. Letting onboarding keep writing
  // would give a live professional a second, wider write path into their own
  // row — the kind of forgotten back door that outlives the feature.
  if (existing && existing.listing_status !== 'draft') {
    return err(
      'CONFLICT_STATE',
      {
        resource: 'professional_profile.listing_status',
        currentState: existing.listing_status,
        attemptedTransition: 'draft_save',
      },
      'Your storefront is already submitted. Edit it from Storefront in your workspace.'
    )
  }

  // Only the credential keys are rewritten; anything else an admin recorded in
  // `certifications` survives a draft save.
  const credentials = parseCredentials(existing?.certifications)
  const nextCredentials = {
    ...(existing?.certifications && typeof existing.certifications === 'object'
      ? (existing.certifications as Record<string, unknown>)
      : {}),
    registration_doc_url:
      body.subtypeDocUrl !== undefined ? body.subtypeDocUrl : credentials.registration_doc_url,
    bir_number: body.birNumber !== undefined ? body.birNumber : credentials.bir_number,
  }

  const tenure = tenureFromYears(body.yearsExperience)

  const fields: Record<string, unknown> = {}
  if (body.businessName !== undefined) fields.business_name = body.businessName
  if (body.ownerName !== undefined) fields.owner_name = body.ownerName
  if (body.categoryId !== undefined) fields.category_id = body.categoryId
  if (body.serviceAreas !== undefined) fields.service_areas = body.serviceAreas
  if (tenure !== undefined) fields.tenure_started = tenure
  if (body.bio !== undefined) fields.bio = body.bio || null
  if (body.profilePhotoUrl !== undefined) fields.profile_photo_url = body.profilePhotoUrl
  // Blank rows are the wizard's empty state, not data — they would render as
  // nameless services on the storefront the moment it went live.
  if (body.services !== undefined) {
    fields.services = body.services.filter((service) => service.name.trim().length > 0)
  }
  if (body.portfolioUrls !== undefined) fields.portfolio_urls = body.portfolioUrls
  if (body.contactWhatsapp !== undefined) fields.contact_whatsapp = body.contactWhatsapp || null
  if (body.subtypeDocUrl !== undefined || body.birNumber !== undefined) {
    fields.certifications = nextCredentials
  }
  // The furthest step reached, never a step backwards — going back to fix
  // something must not lose the fact that later steps were already done.
  if (body.step !== undefined) {
    fields.onboarding_step = Math.max(body.step, existing?.onboarding_step ?? 1)
  }

  if (existing) {
    if (Object.keys(fields).length === 0) return ok({ id: existing.id, created: false })

    const { error } = await access.supabase
      .from('professional_profiles')
      // Assembled from the zod allow-list above; the generated Update type
      // cannot express "some subset of these keys".
      .update(fields as never)
      .eq('id', existing.id)

    if (error) {
      if (error.code === 'P0001') {
        return err('FORBIDDEN_ROLE', { requiredRoles: ['admin'], currentRole: 'professional' })
      }
      logger.error('onboarding:update_failed', { userId: access.userId, code: error.code })
      return err('INTERNAL')
    }

    return ok({ id: existing.id, created: false })
  }

  const { data: created, error: insertError } = await access.supabase
    .from('professional_profiles')
    .insert({
      user_id: access.userId,
      // NOT NULL columns, so they need a value even on a nearly-empty first
      // save. Empty is safe: a draft row is unreachable by any public query.
      business_name: body.businessName ?? '',
      owner_name: body.ownerName ?? '',
      ...fields,
    } as never)
    .select('id')
    .single()

  if (insertError || !created) {
    // 23505 is the unique constraint on user_id: two autosaves raced and the
    // other one won. That is a success from the caller's point of view.
    if (insertError?.code === '23505') return ok({ created: false })
    logger.error('onboarding:insert_failed', { userId: access.userId, code: insertError?.code })
    return err('INTERNAL')
  }

  logger.info('onboarding:draft_created', { userId: access.userId })
  return ok({ id: created.id, created: true })
}
