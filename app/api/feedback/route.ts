/**
 * POST /api/feedback (playbook S089, deck §11.5).
 *
 * Deliberately session-optional: a signed-out visitor reporting a bug is
 * exactly who this form exists for, so there is no auth step and no legal
 * gate — canon order for what remains: rate-limit → zod → write. The write
 * goes through the `submit_feedback` SECURITY DEFINER RPC (20260725000001)
 * because anon never writes tables directly; the RPC captures auth.uid()
 * itself, so a session is attributed without being trusted from the body.
 */
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'

const bodySchema = z.object({
  // Deck §11.5: "Add a message so we know how to help." is the required-field
  // error; name and email are optional.
  message: z.string().trim().min(1).max(5000),
  name: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(320).optional().or(z.literal('')),
})

export async function POST(request: Request) {
  const limit = await checkRateLimit('feedback', identifierFrom(request))
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

  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_feedback', {
    p_message: parsed.data.message,
    p_name: parsed.data.name || undefined,
    p_email: parsed.data.email || undefined,
  })

  if (error) {
    logger.error('feedback:submit_failed', { code: error.code })
    return err('INTERNAL')
  }

  return ok({ received: true })
}
