/**
 * Saved-professionals reads (playbook S084, pack api-marketplace §7).
 *
 * Server-only, RSC-consumed — no GET REST route, same pattern as every other
 * public read (`lib/marketplace/queries.ts`). The write half is the POST
 * /api/saved toggle.
 *
 * All three readers run on the RLS client: `saved_select_own` scopes every
 * query to the signed-in viewer's rows, so none of these can read another
 * customer's shortlist even if miscalled.
 */
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { CARD_COLUMNS, decorateCards, type CardRow } from '@/lib/marketplace/queries'
import type { ProfessionalCardData } from '@/lib/marketplace/professional-card'

/**
 * Whether the signed-in viewer has saved this professional — the storefront
 * SaveButton's initial state. False when nobody is signed in.
 */
export async function isProfessionalSaved(professionalId: string): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('saved_professionals')
    .select('id')
    .eq('customer_id', user.id)
    .eq('professional_id', professionalId)
    .maybeSingle()

  return Boolean(data)
}

/**
 * Every professional id the viewer has saved — for hydrating saved state
 * across a card list (search results, rails) in one query rather than N.
 * Empty set when nobody is signed in.
 */
export async function getSavedProfessionalIds(): Promise<Set<string>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Set()

  const { data } = await supabase
    .from('saved_professionals')
    .select('professional_id')
    .eq('customer_id', user.id)

  return new Set((data ?? []).map((row) => row.professional_id))
}

/**
 * The viewer's saved professionals as card view-models, most recently saved
 * first — the `/saved` page and the customer-home rail (v2/04 §4.1.4; those
 * surfaces land in a later S — the query lands now so the saved API is
 * complete).
 *
 * Cards go through the same CARD_COLUMNS + decorateCards path as search and
 * the landing rails, so a saved professional looks identical everywhere. A
 * professional whose listing has gone inactive drops out silently — RLS
 * returns no row, which is the same no-status-leakage rule the storefront
 * applies.
 */
export async function getSavedProfessionals(): Promise<ProfessionalCardData[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: savedRows, error: savedError } = await supabase
    .from('saved_professionals')
    .select('professional_id')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  if (savedError || !savedRows || savedRows.length === 0) return []
  const savedIds = savedRows.map((row) => row.professional_id)

  const { data: professionals, error: proError } = await supabase
    .from('professional_profiles')
    .select(CARD_COLUMNS)
    .in('id', savedIds)

  if (proError || !professionals) return []

  // Re-impose save recency: `.in()` returns rows in storage order.
  const rowById = new Map(
    (professionals as unknown as CardRow[]).map((row) => [row.id as string, row])
  )
  const ordered = savedIds
    .map((id) => rowById.get(id))
    .filter((row): row is CardRow => row !== undefined)

  return decorateCards(supabase, ordered)
}
