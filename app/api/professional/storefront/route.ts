/**
 * PATCH /api/professional/storefront (playbook S113, spec 05 §5.8).
 *
 * A professional customises their own public storefront. Security is layered:
 * the zod schema below is the ALLOW-LIST — only these fields can be written, so
 * a smuggled `verification_status` or `average_rating` never even reaches the
 * query; RLS (professional_profiles_update_own) scopes the write to the
 * caller's own row; and the DB column guard
 * (guard_professional_privileged_columns) is the final backstop that refuses a
 * self-set of verification/rating no matter what. Three independent layers, so
 * no single mistake opens a hole.
 *
 * Route order: rate-limit -> auth(professional) -> zod -> RLS update.
 * Services are stored as a JSONB array [{ name, price_ttd?, description? }].
 */
import { z } from 'zod'
import { requireProfessional } from '@/lib/access/api'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'

const serviceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  price_ttd: z.number().int().min(0).max(100_000_000).optional(),
  description: z.string().trim().max(280).optional(),
})

/** The editable allow-list. Everything the storefront shows a customer, and
 *  nothing the platform reserves (verification, rating, slug, listing_status). */
const bodySchema = z.object({
  tagline: z.string().trim().max(140).optional(),
  bio: z.string().trim().max(2000).optional(),
  website_url: z.string().trim().url().max(300).optional().or(z.literal('')),
  instagram_handle: z.string().trim().max(60).optional().or(z.literal('')),
  contact_whatsapp: z.string().trim().max(40).optional().or(z.literal('')),
  service_areas: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  services: z.array(serviceSchema).max(40).optional(),
  business_hours: z.record(z.string(), z.string().max(60)).optional(),
})

export async function PATCH(request: Request) {
  const limit = await checkRateLimit('api', identifierFrom(request))
  if (!limit.ok) return limit.response

  const access = await requireProfessional(request)
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
  const body = parsed.data

  // Build the update from present keys only — an absent field is left
  // untouched, an empty string clears an optional text field.
  const update: Record<string, unknown> = {}
  if (body.tagline !== undefined) update.tagline = body.tagline || null
  if (body.bio !== undefined) update.bio = body.bio || null
  if (body.website_url !== undefined) update.website_url = body.website_url || null
  if (body.instagram_handle !== undefined) update.instagram_handle = body.instagram_handle || null
  if (body.contact_whatsapp !== undefined) update.contact_whatsapp = body.contact_whatsapp || null
  if (body.service_areas !== undefined) update.service_areas = body.service_areas
  if (body.services !== undefined) update.services = body.services
  if (body.business_hours !== undefined) update.business_hours = body.business_hours

  if (Object.keys(update).length === 0) {
    return ok({ updated: false })
  }

  const { error } = await access.supabase
    .from('professional_profiles')
    // Dynamically assembled from the zod allow-list; cast past the generated
    // Update shape (the schema above is the real guarantee of what's writable).
    .update(update as never)
    .eq('id', access.professionalId)

  if (error) {
    // The column guard raises on a privileged self-edit — surface it as a 403
    // rather than a 500, but this path should be unreachable given the schema.
    if (error.code === 'P0001') {
      return err('FORBIDDEN_ROLE', { requiredRoles: ['admin'], currentRole: 'professional' })
    }
    logger.error('storefront:update_failed', { code: error.code })
    return err('INTERNAL')
  }

  return ok({ updated: true })
}
