/**
 * GET /api/legal/status (playbook S057, pack `api-marketplace.md` §7)
 *
 * → `{ missing_documents: ["privacy","terms"], accepted: boolean }`
 *
 * The client renders the acceptance modal from `missing_documents`, so the field
 * names are the wire contract and stay snake_case to match the pack verbatim.
 *
 * "Missing" is computed against the in-force VERSION, not the mere presence of an
 * acceptance — someone who accepted Terms v1.0 is missing Terms v2.0. That logic
 * lives once, in `missingLegalAcceptances`, and both this route and the gate call
 * it, so the status endpoint and the gate can never disagree about what is owed.
 */
import { requireAuth, missingLegalAcceptances, LEGAL_DOCUMENTS } from '@/lib/access/api'
import { ok } from '@/lib/api/errors'

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const result = await missingLegalAcceptances(auth, LEGAL_DOCUMENTS)
  if ('response' in result) return result.response

  return ok({
    missing_documents: result.missing,
    accepted: result.missing.length === 0,
  })
}
