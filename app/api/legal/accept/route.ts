/**
 * POST /api/legal/accept (playbook S057, pack `api-marketplace.md` §7)
 *
 * Body: `{ documents: ["privacy","terms","eula","reviews"] }`
 * → 200 `{ accepted: [...], missing_documents: [...] }`
 *
 * A versioned upsert: each accepted document is recorded at its CURRENT version
 * with the caller's IP and user-agent as evidence, and re-accepting the same
 * version is a safe no-op. The evidentiary fields are captured server-side —
 * never taken from the body — because an acceptance record a user can author is
 * not evidence of anything.
 *
 * Route order: rate-limit is unnecessary here (this writes at most four rows for
 * the authenticated caller and is idempotent), so the sequence is auth → zod →
 * write, which is the law with the optional first step omitted deliberately.
 */
import { z } from 'zod'
import {
  requireAuth,
  missingLegalAcceptances,
  CURRENT_LEGAL_VERSIONS,
  LEGAL_DOCUMENTS,
  type LegalDocument,
} from '@/lib/access/api'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'

const bodySchema = z.object({
  // The enum is the guard: a document outside the known set is rejected at the
  // boundary rather than reaching the database's CHECK constraint as a 500.
  documents: z.array(z.enum(LEGAL_DOCUMENTS)).min(1).max(LEGAL_DOCUMENTS.length),
})

/**
 * Evidence, captured here and never from the request body.
 *
 * Reuses the platform header-precedence: the platform-set forwarding headers
 * cannot be forged by a client, unlike the first `x-forwarded-for` entry which
 * the caller writes.
 */
function clientIp(request: Request): string | null {
  const vercel = request.headers.get('x-vercel-forwarded-for')?.trim()
  if (vercel) return vercel
  const real = request.headers.get('x-real-ip')?.trim()
  if (real) return real
  const chain = request.headers.get('x-forwarded-for')
  const last = chain?.split(',').at(-1)?.trim()
  return last || null
}

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

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

  // De-duplicate: a body listing the same document twice must not attempt two
  // conflicting inserts in one upsert batch.
  const documents = [...new Set(parsed.data.documents)] as LegalDocument[]

  const ip = clientIp(request)
  const userAgent = request.headers.get('user-agent')?.slice(0, 512) ?? null

  const rows = documents.map((document) => ({
    user_id: auth.userId,
    document_type: document,
    document_version: CURRENT_LEGAL_VERSIONS[document],
    ip_address: ip,
    user_agent: userAgent,
  }))

  // Upsert on the (user, type, version) unique key. `ignoreDuplicates: true`
  // makes re-acceptance a no-op that keeps the ORIGINAL timestamp and evidence —
  // the first acceptance is the one that counts, and overwriting its IP with a
  // later one would quietly rewrite the record of when consent was given.
  const { error } = await auth.supabase
    .from('legal_acceptances')
    .upsert(rows, { onConflict: 'user_id,document_type,document_version', ignoreDuplicates: true })

  if (error) {
    logger.error('legal:accept_failed', { userId: auth.userId, code: error.code })
    return err('INTERNAL')
  }

  // Re-read the outstanding set so the client can close the modal only when
  // nothing remains, rather than assuming this call cleared everything.
  const remaining = await missingLegalAcceptances(auth, LEGAL_DOCUMENTS)
  if ('response' in remaining) return remaining.response

  return ok({
    accepted: documents,
    missing_documents: remaining.missing,
  })
}
