/**
 * Connection helpers shared by routes that create the contact record as a
 * side-effect (playbook S084 consolidation).
 *
 * POST /api/connections deliberately does NOT use this: its insert's error
 * branches (23505 → existing, 42501 → KYC_REQUIRED) are the response
 * contract, not an "ensure".
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { logger } from '@/lib/utils/logger'

/**
 * Idempotently records the (customer, professional) connection — the contact
 * is on the record and counts against the free-contact gate. A returning
 * customer already has one; the unique pair absorbs the repeat.
 *
 * Log-don't-fail: the caller's primary record (e.g. the enquiry) is the source
 * of truth, and a missed connection row is self-healing — the count is
 * recomputed by trigger.
 */
export async function ensureConnection(
  supabase: SupabaseClient<Database>,
  customerId: string,
  professionalId: string
): Promise<void> {
  const { error } = await supabase
    .from('connections')
    .upsert(
      { customer_id: customerId, professional_id: professionalId },
      { onConflict: 'customer_id,professional_id', ignoreDuplicates: true }
    )
  if (error) {
    logger.error('connection:ensure_failed', {
      professionalId,
      code: error.code,
    })
  }
}
