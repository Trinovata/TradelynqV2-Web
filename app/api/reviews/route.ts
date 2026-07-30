/**
 * POST /api/reviews (playbook S099, spec 04 §4.2 review flow).
 *
 * A customer reviews a professional they actually hired. Eligibility is
 * SERVER-VERIFIED, not trusted from the client: the enquiry must be the
 * caller's own, `completed`, and not already reviewed. RLS only guarantees
 * `customer_id = auth.uid()` on the insert — the "only after a completed job,
 * once" rule lives here.
 *
 * Route order: rate-limit(review) → auth(customer) → zod → eligibility read →
 * RLS insert. Status is server-forced to `pending`: the client can never mint
 * an approved review. reviewer_name comes from the profile, never the body.
 */
import { z } from 'zod'
import { requireCustomer } from '@/lib/access/api'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'

const bodySchema = z.object({
  enquiry_id: z.string().uuid(),
  star_rating: z.number().int().min(1).max(5),
  testimonial: z.string().trim().min(20).max(600),
})

export async function POST(request: Request) {
  const limit = await checkRateLimit('review', identifierFrom(request))
  if (!limit.ok) return limit.response

  const access = await requireCustomer(request)
  if (!access.ok) return access.response

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
  const { enquiry_id, star_rating, testimonial } = parsed.data

  // Eligibility: the caller's own, completed enquiry. RLS scopes the read, so a
  // null is "not yours or not found" — indistinguishable, no status leak.
  const { data: enquiry } = await access.supabase
    .from('job_enquiries')
    .select('id, status, professional_id')
    .eq('id', enquiry_id)
    .maybeSingle()

  if (!enquiry || enquiry.status !== 'completed') {
    return err('CONFLICT_STATE', {
      resource: 'enquiry',
      currentState: enquiry?.status ?? 'not_found',
      attemptedTransition: 'review',
    })
  }

  // One review per enquiry — the CTA is server-gated on this exact check, so a
  // double-submit from a stale tab is refused rather than duplicated.
  const { count } = await access.supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('job_enquiry_id', enquiry_id)
  if ((count ?? 0) > 0) {
    return err('DUPLICATE', { resource: 'review' })
  }

  // reviewer_name from the profile, never the body (a self-assigned name on a
  // public review is an impersonation vector).
  const { data: profile } = await access.supabase
    .from('profiles')
    .select('full_name')
    .eq('id', access.userId)
    .maybeSingle()

  const { data: created, error } = await access.supabase
    .from('reviews')
    .insert({
      professional_id: enquiry.professional_id,
      customer_id: access.userId,
      job_enquiry_id: enquiry_id,
      reviewer_name: profile?.full_name?.trim() || 'A client',
      star_rating,
      testimonial,
      // Server-forced. The moderation queue decides visibility, not the author.
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !created) {
    logger.error('review:create_failed', { enquiryId: enquiry_id, code: error?.code })
    return err('INTERNAL')
  }

  return ok({ success: true, reviewId: created.id, status: 'pending' })
}
