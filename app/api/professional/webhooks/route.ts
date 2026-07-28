/**
 * Webhook endpoint management (playbook S116).
 *
 *   GET  /api/professional/webhooks — list this professional's endpoints
 *   POST /api/professional/webhooks — create one, returning the signing secret ONCE
 *
 * Enterprise-gated. The signing secret is generated here, shown in the POST
 * response exactly once, and stored only as ciphertext — so no later request can
 * reveal it (see lib/webhooks/crypto.ts). The list route never selects the
 * ciphertext at all: there is nothing useful to return, and not selecting it
 * keeps the "shown once" promise legible in the code.
 *
 * Route order: rate-limit -> auth -> tier -> zod -> RLS insert.
 */
import { z } from 'zod'
import { requireProfessional, requireTierFeature } from '@/lib/access/api'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import { EVENT_TYPES } from '@/lib/events/catalog'
import { encryptSecret, generateSigningSecret } from '@/lib/webhooks/crypto'

/** Public-facing columns — everything except the secret ciphertext. */
const LIST_COLUMNS =
  'id, url, events, is_active, consecutive_failures, disabled_at, disabled_reason, last_success_at, created_at'

const createSchema = z.object({
  url: z
    .string()
    .trim()
    .url()
    .refine((u) => u.startsWith('https://'), { message: 'Endpoint URL must use HTTPS.' })
    .refine((u) => u.length <= 2000, { message: 'Endpoint URL is too long.' }),
  // At least one subscribed event; deduplicated so the array the DB stores is clean.
  events: z
    .array(z.enum(EVENT_TYPES))
    .min(1, 'Subscribe to at least one event.')
    .transform((list) => [...new Set(list)]),
})

export async function GET(request: Request) {
  const limit = await checkRateLimit('api', identifierFrom(request))
  if (!limit.ok) return limit.response

  const access = await requireProfessional(request)
  if (!access.ok) return access.response

  const gate = requireTierFeature(access, 'webhooks')
  if (!gate.ok) return gate.response

  const { data, error } = await access.supabase
    .from('webhook_configs')
    .select(LIST_COLUMNS)
    .eq('professional_id', access.professionalId)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('webhook:list_failed', { professionalId: access.professionalId, code: error.code })
    return err('INTERNAL')
  }

  return ok({ webhooks: data ?? [] })
}

export async function POST(request: Request) {
  const limit = await checkRateLimit('api', identifierFrom(request))
  if (!limit.ok) return limit.response

  const access = await requireProfessional(request)
  if (!access.ok) return access.response

  const gate = requireTierFeature(access, 'webhooks')
  if (!gate.ok) return gate.response

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return err('INVALID_INPUT', { fieldErrors: {}, formErrors: ['Send a JSON body.'] })
  }
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return err('INVALID_INPUT', { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors })
  }

  // Generated once, returned once, stored encrypted. The plaintext exists only in
  // this response body — after this it can be rotated but never revealed.
  const signingSecret = generateSigningSecret()

  // Encryption can only fail on a server misconfiguration (a missing or malformed
  // WEBHOOK_SECRET_KEY). Catch it so the failure is a named log line, not a bare
  // unhandled 500 — the message names the exact variable and the fix.
  let secretCiphertext: string
  try {
    secretCiphertext = encryptSecret(signingSecret)
  } catch (cause) {
    logger.error('webhook:encrypt_failed', {
      message: cause instanceof Error ? cause.message : 'unknown',
    })
    return err('INTERNAL')
  }

  const { data, error } = await access.supabase
    .from('webhook_configs')
    .insert({
      professional_id: access.professionalId,
      url: parsed.data.url,
      secret_encrypted: secretCiphertext,
      events: parsed.data.events,
    } as never)
    .select(LIST_COLUMNS)
    .single()

  if (error) {
    logger.error('webhook:create_failed', { professionalId: access.professionalId, code: error.code })
    return err('INTERNAL')
  }

  return ok({ webhook: data, signing_secret: signingSecret }, { status: 201 })
}
