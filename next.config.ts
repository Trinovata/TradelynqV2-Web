import type { NextConfig } from 'next'

/**
 * Build-time production environment assertion (details/backend-processes.md §9).
 *
 * A production deployment missing its rate-limiter credentials would boot happily and
 * serve traffic with rate limiting silently disabled — exactly what happened to V1.
 * Failing the build is loud; failing open is not. So the build refuses.
 *
 * ## When this fires
 *
 * - `VERCEL_ENV=production` — a real production deployment. The case that matters.
 * - `ASSERT_PRODUCTION_ENV=1` — an explicit opt-in, so CI can exercise this check and
 *   so the acceptance criterion is verifiable on demand.
 *
 * It deliberately does NOT fire on a bare local `npm run build`. `next build` sets
 * NODE_ENV=production regardless of where it runs, so asserting on NODE_ENV alone
 * would make every developer's local build require the full production secret set —
 * which would get the check disabled within a week, and a check that gets disabled
 * protects nothing.
 */
const PRODUCTION_REQUIRED: ReadonlyArray<{ name: string; consequence: string }> = [
  {
    name: 'UPSTASH_REDIS_REST_URL',
    consequence: 'rate limiting cannot reach Redis — sensitive limiters would fail closed on every request',
  },
  {
    name: 'UPSTASH_REDIS_REST_TOKEN',
    consequence: 'rate limiting cannot authenticate to Redis — sensitive limiters would fail closed',
  },
  { name: 'CRON_SECRET', consequence: 'scheduled endpoints would be publicly invokable' },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    consequence: 'admin and cron paths cannot reach the database',
  },
  { name: 'NEXT_PUBLIC_SUPABASE_URL', consequence: 'the application cannot reach the database' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', consequence: 'no client can authenticate' },
  { name: 'STRIPE_SECRET_KEY', consequence: 'subscription billing is inoperable' },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    consequence: 'webhook signatures cannot be verified — billing events become forgeable',
  },
  {
    name: 'RESEND_API_KEY',
    consequence: 'no transactional email — silent onboarding and billing failures',
  },
]

function assertProductionEnvAtBuild(): void {
  const shouldAssert =
    process.env.VERCEL_ENV === 'production' || process.env.ASSERT_PRODUCTION_ENV === '1'

  if (!shouldAssert) return

  const missing = PRODUCTION_REQUIRED.filter(({ name }) => {
    const value = process.env[name]
    return !value || value.trim() === ''
  })

  if (missing.length === 0) return

  const detail = missing.map(({ name, consequence }) => `  ✗ ${name}\n      ${consequence}`).join('\n')

  throw new Error(
    `\n[TradeLynq] Production build refused — ${missing.length} required ` +
      `environment variable(s) missing:\n\n${detail}\n\n` +
      `Set these in the Vercel project's Production environment, then redeploy.\n` +
      `Shipping without them would disable protections silently rather than loudly.\n`
  )
}

assertProductionEnvAtBuild()

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Fail the build on type errors rather than shipping them. Next's default already
  // does this; stated explicitly so a future edit has to be deliberate.
  //
  // There is no `eslint` key in Next 16 — linting is no longer part of `next build`.
  // It runs as its own `npm run lint` step, gated in CI (playbook S019).
  typescript: { ignoreBuildErrors: false },

  // Trim the response fingerprint.
  poweredByHeader: false,
}

export default nextConfig
