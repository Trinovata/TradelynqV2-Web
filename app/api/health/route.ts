import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

/**
 * GET /api/health — liveness and dependency check.
 *
 * Consumed by the uptime monitor and by /admin/diagnostics. It answers one question
 * honestly: can this deployment actually serve a request that touches the database?
 *
 * Deliberately unauthenticated (an uptime monitor cannot hold a session) and therefore
 * deliberately uninformative about internals: it reports *that* a dependency is
 * unhealthy, never why. Error text from Postgres describes schema, and this endpoint
 * is world-readable.
 *
 * Cron staleness is added at playbook S220, once cron_heartbeats exists.
 */

// Always fresh. A cached health check reports the health of a past moment, which is
// worse than no health check because it looks authoritative.
export const dynamic = 'force-dynamic'
export const revalidate = 0

type DependencyStatus = {
  status: 'ok' | 'degraded' | 'down'
  latency_ms?: number
}

async function checkDatabase(): Promise<DependencyStatus> {
  const started = Date.now()
  try {
    const supabase = await createClient()

    // Deliberately the cheapest possible round trip that still proves the connection,
    // auth, and query path all work. Selecting real rows would make health-check load
    // scale with table size.
    const { error } = await supabase.rpc('version_check' as never).limit(0)

    const latency = Date.now() - started

    // A missing RPC still proves we reached Postgres and got a structured reply — the
    // connection is healthy even though the function is absent (it lands in Phase 1).
    // Only a transport failure counts as down.
    if (error && !isReachableError(error)) {
      logger.error('health:database_unreachable', { code: error.code })
      return { status: 'down', latency_ms: latency }
    }

    return { status: latency > 1000 ? 'degraded' : 'ok', latency_ms: latency }
  } catch (error) {
    logger.error('health:database_check_threw', { error: String(error) })
    return { status: 'down', latency_ms: Date.now() - started }
  }
}

/** A Postgres-level error means we reached the database; a network error does not. */
function isReachableError(error: { code?: string; message?: string }): boolean {
  // PostgREST returns a code for anything Postgres itself answered.
  if (error.code) return true
  return /does not exist|not found|schema cache/i.test(error.message ?? '')
}

export async function GET() {
  const database = await checkDatabase()

  const healthy = database.status !== 'down'

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'down',
      timestamp: new Date().toISOString(),
      // Identifies which deployment answered — essential when a rollback is in flight
      // and two versions are briefly serving simultaneously.
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
      dependencies: { database },
    },
    {
      // 503 so uptime monitors and load balancers react without parsing the body.
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  )
}
