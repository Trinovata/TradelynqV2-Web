/**
 * POST /api/saved (playbook S084, pack api-marketplace §7)
 *
 * The save toggle. Pack contract: `{ "saved": true, "count": 3 }` with toggle
 * semantics — one endpoint, insert-or-delete, the row's existence IS the state
 * (migration 20260724000000).
 *
 * FLAGS (pack deltas, logged not silently resolved):
 *  - F4: the pack's route is `/api/homeowners/saved-workers` with `worker_id` —
 *    V1 naming. This route follows the S083 precedent (`professional_id`) and
 *    lives at `/api/saved`, matching the `/saved` page namespace in
 *    `lib/routes.ts`.
 *  - F1: NO legal gate. This deviates from the connections/enquiries canon
 *    order deliberately: a save is a private bookmark, not contact — the copy
 *    deck's only save gate is signed-out → login (copy-public.md §5.12 /
 *    §18 UNAUTHENTICATED). The canonical order is otherwise intact:
 *    rate-limit → auth/role → zod → RLS client.
 *
 * `save_toggled` is CLIENT-layer per analytics-events.md (EMISSION_LAYER) —
 * this route emits nothing; do not copy the connections route's server
 * emissions.
 */
import { z } from 'zod'
import { requireCustomer } from '@/lib/access/api'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'

const bodySchema = z.object({
  professional_id: z.string().uuid(),
})

export async function POST(request: Request) {
  // 1. Rate-limit — own `save` key (30/60): a toggle loop is DB-write
  // stuffing, not contact harvesting; reusing `connection` (10/60) would let
  // save toggles starve genuine reveals.
  const limit = await checkRateLimit('save', identifierFrom(request))
  if (!limit.ok) return limit.response

  // 2. Session — must be a customer. (No legal gate — flag F1 above.)
  const ctx = await requireCustomer(request)
  if (!ctx.ok) return ctx.response

  // 3. zod.
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

  // 4. The professional must exist and be active. RLS only returns a row for
  // an ACTIVE public listing, so a null here is indistinguishable from
  // never-existed — no status leakage (same as the connections route).
  const { data: professional, error: proError } = await ctx.supabase
    .from('professional_profiles')
    .select('id')
    .eq('id', professional_id)
    .maybeSingle()

  if (proError) {
    logger.error('save:professional_lookup_failed', { code: proError.code })
    return err('INTERNAL')
  }
  if (!professional) {
    return err('NOT_FOUND', { resource: 'professional' })
  }

  // 5. The toggle. Try the insert; a unique-pair violation (23505) means the
  // row exists, so the toggle's other half is the delete. The unique
  // constraint makes this race-safe — two concurrent toggles cannot
  // double-insert.
  let saved = true
  const { error: insertError } = await ctx.supabase
    .from('saved_professionals')
    .insert({ customer_id: ctx.userId, professional_id })

  if (insertError) {
    if (insertError.code === '23505') {
      saved = false
      const { error: deleteError } = await ctx.supabase
        .from('saved_professionals')
        .delete()
        .eq('customer_id', ctx.userId)
        .eq('professional_id', professional_id)
      if (deleteError) {
        logger.error('save:delete_failed', {
          professionalId: professional_id,
          code: deleteError.code,
        })
        return err('INTERNAL')
      }
    } else {
      logger.error('save:insert_failed', {
        professionalId: professional_id,
        code: insertError.code,
      })
      return err('INTERNAL')
    }
  }

  // 6. Fresh count — recounted from the table, never arithmetic on the
  // previous response (the "recount, not increment" doctrine).
  const { count, error: countError } = await ctx.supabase
    .from('saved_professionals')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', ctx.userId)

  if (countError) {
    logger.error('save:count_failed', { code: countError.code })
  }

  // Pack §7 shape verbatim: { saved, count }.
  return ok({ saved, count: count ?? 0 })
}
