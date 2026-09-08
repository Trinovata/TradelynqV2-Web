/**
 * POST /api/professional/onboarding/publish (playbook S107, spec `v2/05 §5.2`).
 *
 * The last step: the storefront leaves `draft` and enters the moderation queue
 * as `pending_review`. Publication itself is an admin decision — this route can
 * only ever make that one hop, because
 * `guard_professional_privileged_columns` refuses every other transition at the
 * database level.
 *
 * Route order: rate-limit -> auth(role) -> legal -> zod -> RLS write.
 *
 * ## Completeness is checked against the ROW, not the request
 *
 * The wizard validates each step before letting a professional advance, but
 * that is UX. A client that POSTs straight here would otherwise submit an empty
 * storefront into the moderation queue. So the schemas run against what is
 * actually stored — the only thing an admin will see.
 *
 * ## Seeded reviews
 *
 * Pre-platform customers a professional vouches for. They are written with
 * `is_seeded = true` and `status = 'pending'`, which means: an admin must phone
 * the customer before the review ever appears (`api-admin-cron.md §2.1`), and
 * until then it contributes nothing — `recalculate_professional_rating` counts
 * only `approved` and `featured`. They need the admin client because
 * `guard_review_insert` blanks `is_seeded` for any session-authored row, which
 * is precisely the self-vouching this flag exists to prevent. The route, not
 * the caller, sets the professional_id — from the caller's own profile.
 */
import {
  requireRole,
  ensureLegalAcceptances,
  PROFESSIONAL_ONBOARDING_LEGAL,
} from '@/lib/access/api'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity, flushAnalytics } from '@/lib/analytics/server'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import { publishSchema, stepSchemas } from '@/lib/professional/onboarding'

export async function POST(request: Request) {
  const limit = await checkRateLimit('api', identifierFrom(request))
  if (!limit.ok) return limit.response

  const access = await requireRole(['professional'], request)
  if (!access.ok) return access.response

  const legal = await ensureLegalAcceptances(access, PROFESSIONAL_ONBOARDING_LEGAL)
  if (!legal.ok) return legal.response

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return err('INVALID_INPUT', { fieldErrors: {}, formErrors: ['Send a JSON body.'] })
  }

  const parsed = publishSchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return err('INVALID_INPUT', { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors })
  }

  const { data: row, error: readError } = await access.supabase
    .from('professional_profiles')
    .select(
      'id, slug, listing_status, business_name, owner_name, category_id, service_areas, tenure_started, bio, profile_photo_url, services, portfolio_urls, created_at'
    )
    .eq('user_id', access.userId)
    .maybeSingle()

  if (readError) {
    logger.error('onboarding:publish_read_failed', { userId: access.userId, code: readError.code })
    return err('INTERNAL')
  }

  if (!row) {
    return err(
      'NOT_FOUND',
      { resource: 'professional_profile' },
      'Start your storefront before publishing it.'
    )
  }

  // Idempotent: a double-tapped Publish, or a retry after a dropped response,
  // reads as success rather than a confusing error on the success screen.
  if (row.listing_status === 'pending_review') {
    return ok({ slug: row.slug, status: row.listing_status, alreadySubmitted: true })
  }

  if (row.listing_status !== 'draft') {
    return err(
      'CONFLICT_STATE',
      {
        resource: 'professional_profile.listing_status',
        currentState: row.listing_status,
        attemptedTransition: 'pending_review',
      },
      'This storefront is already live.'
    )
  }

  // ── Completeness, from the stored row ────────────────────────────────────
  const services = Array.isArray(row.services) ? row.services : []
  const stored = {
    businessName: row.business_name ?? '',
    ownerName: row.owner_name ?? '',
    categoryId: row.category_id ?? '',
    serviceAreas: row.service_areas ?? [],
    yearsExperience: null,
    bio: row.bio ?? '',
    profilePhotoUrl: row.profile_photo_url,
    services,
  }

  const fieldErrors: Record<string, string[]> = {}
  for (const step of [1, 2, 3] as const) {
    const result = stepSchemas[step].safeParse(stored)
    if (!result.success) {
      for (const [field, messages] of Object.entries(result.error.flatten().fieldErrors)) {
        if (messages && messages.length > 0) fieldErrors[field] = messages
      }
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return err('INVALID_INPUT', {
      fieldErrors,
      formErrors: ['Finish the earlier steps before publishing.'],
    })
  }

  // ── Seeded reviews (before the status hop, so a failure here is recoverable
  //    by pressing Publish again rather than leaving reviews orphaned) ──────
  const seedReviews = parsed.data.seedReviews ?? []
  if (seedReviews.length > 0) {
    const admin = createAdminClient()
    const { error: seedError } = await admin.from('reviews').insert(
      seedReviews.map((review) => ({
        professional_id: row.id,
        customer_id: null,
        reviewer_name: review.customer_name,
        reviewer_phone: review.phone,
        star_rating: review.rating,
        testimonial: review.text,
        is_seeded: true,
        // Explicit rather than relying on the column default: this is the value
        // that keeps an unverified testimonial off a live storefront.
        status: 'pending' as const,
      }))
    )

    if (seedError) {
      logger.error('onboarding:seed_reviews_failed', {
        userId: access.userId,
        code: seedError.code,
      })
      return err(
        'INTERNAL',
        'Your storefront is saved, but those reviews didn’t send. Try Publish again.'
      )
    }
  }

  const { data: updated, error: updateError } = await access.supabase
    .from('professional_profiles')
    .update({ listing_status: 'pending_review', onboarding_step: 5 } as never)
    .eq('id', row.id)
    // Conditional on still being a draft: if two publishes race, the second
    // matches no row rather than re-submitting.
    .eq('listing_status', 'draft')
    .select('slug, listing_status')
    .maybeSingle()

  if (updateError) {
    if (updateError.code === 'P0001') {
      return err('FORBIDDEN_ROLE', { requiredRoles: ['admin'], currentRole: 'professional' })
    }
    logger.error('onboarding:publish_failed', { userId: access.userId, code: updateError.code })
    return err('INTERNAL')
  }

  logger.info('onboarding:published', { userId: access.userId, seeded: seedReviews.length })

  // Server-emitted (`EMISSION_LAYER.onboarding_completed = 'server'`): completion
  // is a state-machine fact, and a client-claimed one would let an abandoned
  // signup report itself as a conversion. `total_ms` is measured from the row's
  // creation, which is the first keystroke of step 1.
  await logActivity(
    'onboarding_completed',
    {
      total_ms: row.created_at ? Date.now() - new Date(row.created_at).getTime() : 0,
      photos_added: Array.isArray(row.portfolio_urls) ? row.portfolio_urls.length : 0,
      seeded_reviews: seedReviews.length,
    },
    { userId: access.userId, entityType: 'professional_profile', entityId: row.id }
  )
  // Serverless freezes between invocations; an unflushed queue is a lost event.
  await flushAnalytics()

  return ok({
    slug: updated?.slug ?? row.slug,
    status: updated?.listing_status ?? 'pending_review',
    alreadySubmitted: false,
  })
}
