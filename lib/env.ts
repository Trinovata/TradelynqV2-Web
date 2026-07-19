/**
 * Environment access — validated, with errors that name the fix.
 *
 * Why this exists: V1 read env vars with non-null assertions (`process.env.FOO!`),
 * so a missing variable surfaced as an opaque failure deep inside a client
 * constructor. Here, a missing variable fails immediately and says which variable,
 * which file to set it in, and what it is for.
 *
 * NEXT_PUBLIC_* vars are inlined by Next at build time, so they MUST be written as
 * literal `process.env.NEXT_PUBLIC_X` expressions. A dynamic lookup (`process.env[k]`)
 * silently returns undefined in the browser. That is why the public half of this
 * module is hand-written rather than generated from a list.
 */

/** Thrown when a required variable is absent. Names the variable and the fix. */
class MissingEnvError extends Error {
  constructor(name: string, purpose: string) {
    super(
      `[TradeLynq] Missing required environment variable: ${name}\n` +
        `  Purpose: ${purpose}\n` +
        `  Fix: add ${name} to .env.local (see .env.example for the full surface).`
    )
    this.name = 'MissingEnvError'
  }
}

function required(value: string | undefined, name: string, purpose: string): string {
  if (!value || value.trim() === '') throw new MissingEnvError(name, purpose)
  return value
}

// ── Public (browser-safe, inlined at build) ──────────────────────────────────

export const publicEnv = {
  get supabaseUrl(): string {
    return required(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      'NEXT_PUBLIC_SUPABASE_URL',
      'Supabase project endpoint'
    )
  },
  get supabaseAnonKey(): string {
    return required(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'Supabase anonymous key (RLS-enforced client access)'
    )
  },
  /** Canonical origin. Used for absolute links in emails, tokens, and OG tags. */
  get appUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  },
} as const

// ── Server-only ──────────────────────────────────────────────────────────────

export const serverEnv = {
  get supabaseServiceRoleKey(): string {
    return required(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      'SUPABASE_SERVICE_ROLE_KEY',
      'Supabase service-role key — bypasses RLS, server-only, never sent to a client'
    )
  },
  get cronSecret(): string {
    return required(
      process.env.CRON_SECRET,
      'CRON_SECRET',
      'Shared secret authenticating scheduled job invocations'
    )
  },
} as const

// ── Runtime facts ────────────────────────────────────────────────────────────

export const isProduction = process.env.NODE_ENV === 'production'
export const isTest = process.env.NODE_ENV === 'test'

/**
 * True only in a real production deployment — not in a local production build.
 *
 * The distinction matters: `npm run build` locally sets NODE_ENV=production but
 * has no deployment secrets, and should not be held to production's requirements.
 * Vercel sets VERCEL_ENV=production only for actual production deploys.
 */
export const isProductionDeployment = process.env.VERCEL_ENV === 'production'

/**
 * Variables without which a production deployment is unsafe, not merely degraded.
 *
 * Each entry states the consequence of its absence, because a list of names does
 * not tell a future reader why the build was allowed to fail over it.
 */
const PRODUCTION_REQUIRED: ReadonlyArray<{ name: string; consequence: string }> = [
  {
    name: 'UPSTASH_REDIS_REST_URL',
    consequence: 'rate limiting cannot reach Redis, so sensitive limiters fail closed',
  },
  {
    name: 'UPSTASH_REDIS_REST_TOKEN',
    consequence: 'rate limiting cannot authenticate to Redis, so sensitive limiters fail closed',
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
    consequence: 'webhook signatures cannot be verified — forgeable billing events',
  },
  {
    name: 'RESEND_API_KEY',
    consequence: 'no transactional email sends — silent onboarding and billing failures',
  },
]

/**
 * Fails a production deployment that is missing a variable it cannot safely run without.
 *
 * Called from instrumentation at server start. Deliberately loud: a deployment that
 * boots without rate limiting or webhook verification is worse than one that refuses
 * to boot, because the first failure mode is silent and the second is not.
 */
export function assertProductionEnv(): void {
  if (!isProductionDeployment) return

  const missing = PRODUCTION_REQUIRED.filter(({ name }) => {
    const value = process.env[name]
    return !value || value.trim() === ''
  })

  if (missing.length > 0) {
    const detail = missing.map(({ name, consequence }) => `  - ${name}: ${consequence}`).join('\n')
    throw new Error(
      `[TradeLynq] Refusing to start: ${missing.length} required production ` +
        `environment variable(s) missing.\n${detail}\n` +
        `Set these in the Vercel project's Production environment.`
    )
  }
}
