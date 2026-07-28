import 'server-only'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/utils/logger'
import { decryptSecret, signPayload } from '@/lib/webhooks/crypto'
import { checkPublicUrl } from '@/lib/webhooks/ssrf'
import type { EventEnvelope } from '@/lib/events/catalog'

/**
 * The webhook dispatcher (playbook S116).
 *
 * Given one event for one professional, it finds every active endpoint
 * subscribed to that event and delivers a signed copy to each. It runs on the
 * SERVICE-ROLE client for two reasons the RLS layer makes unavoidable: it must
 * read `secret_encrypted` (no policy exposes it to the owner) and it must write
 * the delivery statistics the `guard_webhook_privileged_columns` trigger forbids
 * the owner from touching. `auth.uid()` is NULL under service role, which is the
 * exact branch that trigger waves through.
 *
 * Delivery is best-effort with a bounded in-invocation retry — right for a
 * launch baseline where events fire from `after()` on Vercel. A dead endpoint is
 * not retried forever: five consecutive failed deliveries auto-disable it, so one
 * broken consumer cannot turn our dispatcher into its own slow DoS. Durable
 * cross-request retry (a queue + cron drain) is the next hardening step and does
 * not change this contract.
 */

const MAX_ATTEMPTS = 3
const BACKOFF_MS = [0, 500, 2000] as const
const REQUEST_TIMEOUT_MS = 10_000
const AUTO_DISABLE_THRESHOLD = 5
const RESPONSE_EXCERPT_LIMIT = 500
// Cap simultaneous outbound deliveries per event so a professional with many
// endpoints cannot make one event hold an unbounded number of open sockets (and
// the whole fan-out finish inside the function's post-response budget).
const MAX_CONCURRENT_DELIVERIES = 5
// Never buffer more than this from an endpoint's response — a hostile endpoint
// could otherwise stream gigabytes and OOM the invocation. Comfortably covers the
// 500-char excerpt after UTF-8 decode.
const MAX_RESPONSE_BYTES = RESPONSE_EXCERPT_LIMIT * 8

type ConfigRow = {
  id: string
  url: string
  secret_encrypted: string
}

/**
 * Deliver an event to all of a professional's subscribed endpoints.
 *
 * Never throws: it is called from `after()`, where an unhandled rejection is
 * invisible and cannot reach the user. Every failure path logs instead.
 */
export async function dispatchEvent(envelope: EventEnvelope): Promise<void> {
  const admin = createAdminClient()

  const { data: configs, error } = await admin
    .from('webhook_configs')
    .select('id, url, secret_encrypted')
    .eq('professional_id', envelope.professional_id)
    .eq('is_active', true)
    .is('disabled_at', null)
    .contains('events', [envelope.type])

  if (error) {
    logger.error('webhook:config_lookup_failed', {
      professionalId: envelope.professional_id,
      eventType: envelope.type,
      code: error.code,
    })
    return
  }
  if (!configs || configs.length === 0) return

  // The exact bytes every consumer signs over — serialise ONCE so the signature
  // matches what leaves the wire, and reuse it across endpoints.
  const rawBody = JSON.stringify(envelope)

  await mapWithConcurrency(configs as ConfigRow[], MAX_CONCURRENT_DELIVERIES, (config) =>
    deliverToEndpoint(admin, config, envelope, rawBody)
  )
}

/**
 * Run `fn` over `items` with at most `limit` in flight at once. A worker that
 * throws does not stop its peers (each call is isolated) — the equivalent of
 * Promise.allSettled, but bounded so a large fan-out cannot open N sockets at
 * once.
 */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0
  const runNext = async (): Promise<void> => {
    while (cursor < items.length) {
      const item = items[cursor++]
      if (item === undefined) continue
      await fn(item).catch(() => {})
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext))
}

async function deliverToEndpoint(
  admin: ReturnType<typeof createAdminClient>,
  config: ConfigRow,
  envelope: EventEnvelope,
  rawBody: string
): Promise<void> {
  // SSRF boundary (re-checked here, not just at config time): DNS is mutable, so
  // a hostname that was public when the endpoint was created may now resolve to a
  // private or metadata address. Never fetch a URL that fails the guard NOW.
  const guard = await checkPublicUrl(config.url)
  if (!guard.ok) {
    logger.error('webhook:blocked_non_public_url', { configId: config.id })
    await recordAttempt(admin, config, envelope, {
      succeeded: false,
      attempt: 1,
      error: 'blocked_non_public_url',
    })
    await applyDeliveryOutcome(admin, config, false)
    return
  }

  let secret: string
  try {
    secret = decryptSecret(config.secret_encrypted)
  } catch {
    // A secret we cannot decrypt can never produce a verifiable signature.
    // Record the failure rather than sending garbage a consumer will reject.
    logger.error('webhook:secret_decrypt_failed', { configId: config.id })
    await recordAttempt(admin, config, envelope, {
      succeeded: false,
      attempt: 1,
      error: 'secret_decrypt_failed',
    })
    await applyDeliveryOutcome(admin, config, false)
    return
  }

  const signature = signPayload(rawBody, secret)
  let lastOutcome: AttemptOutcome = { succeeded: false, attempt: 1, error: 'not_attempted' }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (BACKOFF_MS[attempt - 1]) await sleep(BACKOFF_MS[attempt - 1]!)
    lastOutcome = await attemptDelivery(config, envelope, rawBody, signature, attempt)
    await recordAttempt(admin, config, envelope, lastOutcome)
    if (lastOutcome.succeeded) break
  }

  await applyDeliveryOutcome(admin, config, lastOutcome.succeeded)
}

type AttemptOutcome = {
  succeeded: boolean
  attempt: number
  statusCode?: number
  durationMs?: number
  error?: string
  responseExcerpt?: string
}

/** One HTTP POST. A 2xx is success; anything else (or a network error) is not. */
async function attemptDelivery(
  config: ConfigRow,
  envelope: EventEnvelope,
  rawBody: string,
  signature: string,
  attempt: number
): Promise<AttemptOutcome> {
  const startedAt = performance.now()
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'TradeLynq-Webhooks/1.0',
        'x-tradelynq-event': envelope.type,
        'x-tradelynq-delivery': envelope.id,
        'x-tradelynq-signature': signature,
      },
      body: rawBody,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: 'error', // a signed payload must not follow a redirect off-endpoint
    })
    const durationMs = Math.round(performance.now() - startedAt)
    const excerpt = (await safeReadBody(response)).slice(0, RESPONSE_EXCERPT_LIMIT)
    return {
      succeeded: response.ok,
      attempt,
      statusCode: response.status,
      durationMs,
      responseExcerpt: excerpt,
      error: response.ok ? undefined : `http_${response.status}`,
    }
  } catch (cause) {
    const durationMs = Math.round(performance.now() - startedAt)
    const message = cause instanceof Error ? cause.name : 'network_error'
    return { succeeded: false, attempt, durationMs, error: message }
  }
}

/** Append a per-attempt row to the delivery log. */
async function recordAttempt(
  admin: ReturnType<typeof createAdminClient>,
  config: ConfigRow,
  envelope: EventEnvelope,
  outcome: AttemptOutcome
): Promise<void> {
  const { error } = await admin.from('webhook_delivery_log').insert({
    webhook_config_id: config.id,
    event_type: envelope.type,
    status_code: outcome.statusCode ?? null,
    succeeded: outcome.succeeded,
    attempt: outcome.attempt,
    duration_ms: outcome.durationMs ?? null,
    error: outcome.error ?? null,
    response_excerpt: outcome.responseExcerpt ?? null,
  } as never)
  if (error) {
    logger.error('webhook:delivery_log_failed', { configId: config.id, code: error.code })
  }
}

/**
 * Fold one delivery's result into the endpoint's health. Success resets the
 * failure streak and stamps `last_success_at`; failure increments it and, at the
 * threshold, auto-disables with a recorded reason (the schema forbids a disabled
 * row without one).
 */
async function applyDeliveryOutcome(
  admin: ReturnType<typeof createAdminClient>,
  config: ConfigRow,
  succeeded: boolean
): Promise<void> {
  if (succeeded) {
    const { error } = await admin
      .from('webhook_configs')
      .update({ consecutive_failures: 0, last_success_at: new Date().toISOString() } as never)
      .eq('id', config.id)
    if (error) logger.error('webhook:reset_streak_failed', { configId: config.id, code: error.code })
    return
  }

  // Atomic in-DB increment + threshold check under the row lock (bump_webhook_
  // failure RPC). An app-side read-modify-write here loses concurrent increments
  // and can false-disable a healthy endpoint when a stale failure lands after a
  // success reset — deliveries to one endpoint run concurrently via after().
  const { error } = await admin.rpc('bump_webhook_failure', {
    p_config_id: config.id,
    p_threshold: AUTO_DISABLE_THRESHOLD,
  })
  if (error) logger.error('webhook:bump_streak_failed', { configId: config.id, code: error.code })
}

// ── Test ping (synchronous, single endpoint) ─────────────────────────────────

export type TestResult = {
  succeeded: boolean
  statusCode?: number
  durationMs?: number
  error?: string
}

/**
 * Send a one-off `ping` to a single endpoint and return the result to the caller.
 *
 * Unlike `dispatchEvent`, this is synchronous and single-attempt: the owner is
 * standing on the integrations screen waiting to see whether their endpoint
 * answered, so a fast, honest yes/no beats a retried best-effort they can't see.
 * It still logs the attempt (a test appears in the delivery log like any other)
 * and folds the result into the endpoint's health, so a failing test also counts
 * toward auto-disable — a test is a real delivery, not a special case.
 *
 * Ownership is the caller's responsibility: the route proves it on the RLS client
 * before calling in, so this trusts the (configId, professionalId) pair.
 */
export async function sendTestPing(configId: string, professionalId: string): Promise<TestResult> {
  const admin = createAdminClient()

  const { data: config, error } = await admin
    .from('webhook_configs')
    .select('id, url, secret_encrypted')
    .eq('id', configId)
    .eq('professional_id', professionalId)
    .maybeSingle()

  if (error || !config) {
    logger.error('webhook:test_config_lookup_failed', { configId, code: error?.code })
    return { succeeded: false, error: 'config_not_found' }
  }

  const envelope: EventEnvelope<'ping'> = {
    id: randomUUID(),
    type: 'ping',
    created_at: new Date().toISOString(),
    professional_id: professionalId,
    data: { message: 'This is a test delivery from TradeLynq.', sent_at: new Date().toISOString() },
  }
  const rawBody = JSON.stringify(envelope)

  // SSRF boundary. The test path is the most abusable — a synchronous fetch to an
  // arbitrary host on demand — so it must clear the same guard as real delivery.
  const guard = await checkPublicUrl(config.url)
  if (!guard.ok) {
    logger.error('webhook:test_blocked_non_public_url', { configId })
    await recordAttempt(admin, config as ConfigRow, envelope, {
      succeeded: false,
      attempt: 1,
      error: 'blocked_non_public_url',
    })
    await applyDeliveryOutcome(admin, config as ConfigRow, false)
    return { succeeded: false, error: 'blocked_non_public_url' }
  }

  let signature: string
  try {
    signature = signPayload(rawBody, decryptSecret((config as ConfigRow).secret_encrypted))
  } catch {
    logger.error('webhook:test_secret_decrypt_failed', { configId })
    return { succeeded: false, error: 'secret_decrypt_failed' }
  }

  const outcome = await attemptDelivery(config as ConfigRow, envelope, rawBody, signature, 1)
  await recordAttempt(admin, config as ConfigRow, envelope, outcome)
  await applyDeliveryOutcome(admin, config as ConfigRow, outcome.succeeded)

  return {
    succeeded: outcome.succeeded,
    statusCode: outcome.statusCode,
    durationMs: outcome.durationMs,
    error: outcome.error,
  }
}

/**
 * Read at most MAX_RESPONSE_BYTES from the response, then cancel the stream. The
 * excerpt is only ever a 500-char diagnostic, so there is no reason to buffer a
 * whole body — and doing so lets a hostile endpoint stream gigabytes and OOM the
 * invocation (which shares its instance with live user requests under `after()`).
 */
async function safeReadBody(response: Response): Promise<string> {
  try {
    const body = response.body
    if (!body) return ''
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let out = ''
    let total = 0
    while (total < MAX_RESPONSE_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        total += value.byteLength
        out += decoder.decode(value, { stream: true })
      }
    }
    out += decoder.decode()
    await reader.cancel().catch(() => {})
    return out
  } catch {
    return ''
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
