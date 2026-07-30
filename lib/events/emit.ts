import 'server-only'
import { randomUUID } from 'node:crypto'
import { after } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { EVENT_REGISTRY, type EventEnvelope, type EventInput } from '@/lib/events/catalog'
import { dispatchEvent } from '@/lib/webhooks/dispatch'

/**
 * Emit a domain event (playbook S116).
 *
 * This is the ONLY entry point a tool route uses. A route that just completed a
 * job calls `emitEvent(professionalId, { type: 'job.completed', data })` and
 * returns — it never touches webhooks, signing, or delivery. The `type` narrows
 * `data` to that event's payload, so the compiler rejects a malformed emit at the
 * call site.
 *
 * Three properties that keep this safe to sprinkle through business logic:
 *
 *   1. **It never throws.** A webhook problem must never fail the customer-facing
 *      action that triggered it. Every path here is wrapped; failures log.
 *   2. **It never adds latency.** Delivery is handed to `after()`, which runs
 *      once the HTTP response is already on its way to the user.
 *   3. **It never sends garbage.** The payload is validated against the catalog
 *      schema first; a shape that fails is dropped-and-logged, not signed and
 *      shipped to a consumer that will only reject it.
 */
export function emitEvent(professionalId: string, event: EventInput): void {
  try {
    const def = EVENT_REGISTRY[event.type]
    const parsed = def.schema.safeParse(event.data)
    if (!parsed.success) {
      logger.error('event:invalid_payload', {
        eventType: event.type,
        issues: parsed.error.issues.map((i) => i.path.join('.')),
      })
      return
    }

    const envelope: EventEnvelope = {
      id: randomUUID(),
      type: event.type,
      created_at: new Date().toISOString(),
      professional_id: professionalId,
      data: parsed.data as EventEnvelope['data'],
    }

    scheduleDispatch(envelope)
  } catch (cause) {
    logger.error('event:emit_failed', {
      eventType: event.type,
      message: cause instanceof Error ? cause.message : 'unknown',
    })
  }
}

/**
 * Hand delivery to the post-response phase. Inside a request `after()` defers it
 * until the response is flushed; outside one (a cron, a test) there is no
 * after-context, so we fall back to a detached promise — the dispatcher swallows
 * its own errors, so a floating rejection is not a risk.
 */
function scheduleDispatch(envelope: EventEnvelope): void {
  try {
    after(() => dispatchEvent(envelope))
  } catch {
    void dispatchEvent(envelope)
  }
}
