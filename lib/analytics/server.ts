import 'server-only'
import { PostHog } from 'posthog-node'
import { logger } from '@/lib/utils/logger'
import { EMISSION_LAYER, type EventName, type EventProps } from '@/lib/analytics/events'

/**
 * Server-side analytics emission (v2/13 §13.2).
 *
 * Server events are the only trustworthy source for money, moderation, and
 * state-machine truth — a client can claim anything. `logActivity` is how those facts
 * are recorded, and it fans out to two places:
 *
 *   1. **PostHog** — product analytics, funnels, cohorts.
 *   2. **`user_activity_log`** — our own durable record, queryable by admin, and the
 *      backing store for DSAR export. NOT YET WIRED: the table lands at playbook S040.
 *      The call is structured for it now so the fan-out is a one-line change rather
 *      than a retrofit across every call site.
 *
 * Analytics must never be able to break a request. Every path here swallows its own
 * errors and logs them; a PostHog outage degrades reporting, not the product.
 */

let client: PostHog | undefined

function getClient(): PostHog | undefined {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return undefined

  client ??= new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    // Serverless functions are frozen between invocations, so a large in-memory queue
    // would silently lose events at freeze time. Flush eagerly instead.
    flushAt: 1,
    flushInterval: 0,
  })

  return client
}

type ActivityContext = {
  /** The acting user. Null for system-originated events (cron, webhook consumers). */
  userId: string | null
  /** The entity this event concerns, for the activity log's index. */
  entityType?: string
  entityId?: string
}

/**
 * Records a server-side event.
 *
 * Typed against the same `EventProps` contract the client uses, so an event cannot
 * drift between the two emission layers.
 */
export async function logActivity<E extends EventName>(
  event: E,
  props: EventProps[E],
  context: ActivityContext
): Promise<void> {
  // A client-layer event arriving here is a miswiring, not a security problem — but it
  // means the event will be double-counted or attributed to the wrong layer, which
  // quietly corrupts funnels. Loud in development, tolerated in production.
  if (EMISSION_LAYER[event] === 'client') {
    logger.warn('analytics:client_event_from_server', {
      event,
      hint: 'This event is declared client-layer. Emit it via track(), or change its layer in events.ts.',
    })
  }

  const posthog = getClient()
  if (posthog) {
    try {
      posthog.capture({
        // PostHog requires a distinct id. System events are attributed to a stable
        // synthetic actor so they remain queryable rather than being dropped.
        distinctId: context.userId ?? 'system',
        event,
        properties: {
          ...props,
          platform: 'web',
          $process_person_profile: context.userId !== null,
        },
      })
    } catch (error) {
      logger.error('analytics:posthog_capture_failed', { event, error: String(error) })
    }
  }

  // TODO(S040): insert into user_activity_log via createAdminClient() once the table
  // exists. Deliberately not stubbed with a silent no-op that looks like it works.
}

/**
 * Flushes pending events. Call before a serverless function returns, otherwise the
 * runtime may freeze the process with events still queued.
 */
export async function flushAnalytics(): Promise<void> {
  const posthog = getClient()
  if (!posthog) return
  try {
    await posthog.flush()
  } catch (error) {
    logger.error('analytics:flush_failed', { error: String(error) })
  }
}
