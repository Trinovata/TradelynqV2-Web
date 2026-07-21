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
    consequence:
      'rate limiting cannot reach Redis — sensitive limiters would fail closed on every request',
  },
  {
    name: 'UPSTASH_REDIS_REST_TOKEN',
    consequence:
      'rate limiting cannot authenticate to Redis — sensitive limiters would fail closed',
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

  const detail = missing
    .map(({ name, consequence }) => `  ✗ ${name}\n      ${consequence}`)
    .join('\n')

  throw new Error(
    `\n[TradeLynq] Production build refused — ${missing.length} required ` +
      `environment variable(s) missing:\n\n${detail}\n\n` +
      `Set these in the Vercel project's Production environment, then redeploy.\n` +
      `Shipping without them would disable protections silently rather than loudly.\n`
  )
}

assertProductionEnvAtBuild()

/**
 * Content Security Policy (v2/17 §17.8 — `unsafe-eval` is launch-blocking in prod).
 *
 * Every entry below is an obligation, not a convenience: an allow-listed origin is
 * attack surface that someone must keep justifying. V1's policy was audited against
 * actual usage during this step and two entries were removed —
 *
 *   F1 `*.pusher.com` — allow-listed in V1, but a repo-wide search finds Pusher in
 *      next.config.mjs and the docs only. No realtime feature exists. Removed.
 *
 *   F2 `graph.facebook.com` — the WhatsApp Cloud API *is* real, but it is called from
 *      server routes (lib/whatsapp/client.ts). CSP connect-src governs *browser*
 *      requests; a server-side fetch is not subject to it. The entry never did
 *      anything. Removed.
 *
 * Google Fonts is likewise absent: V2 self-hosts Satoshi and JetBrains Mono via
 * next/font/local (S059), so there is no font request to a third party.
 *
 * Stripe has no entry yet because checkout and the billing portal are redirects, not
 * embedded frames. If Stripe.js is ever embedded, js.stripe.com needs adding to
 * script-src and frame-src — deliberately not pre-allowed.
 */
const isDev = process.env.NODE_ENV !== 'production'
const isPreviewDeployment = process.env.VERCEL_ENV === 'preview'

const scriptSrc = [
  "'self'",
  // Next's inline bootstrap and hydration scripts.
  // KNOWN WEAKNESS: 'unsafe-inline' materially reduces XSS protection. The fix is a
  // nonce-based policy issued per request from middleware. Not launch-blocking per
  // §17.8 (which names unsafe-EVAL specifically) but it is the next hardening step,
  // and it is cheap to do once middleware exists at S050.
  "'unsafe-inline'",
  'https://*.posthog.com',
  'https://*.i.posthog.com',
]
// unsafe-eval is a development-only affordance for React Refresh. It must never
// reach production — that is an explicit launch gate.
if (isDev) scriptSrc.push("'unsafe-eval'")
if (isPreviewDeployment) scriptSrc.push('https://vercel.live')

const connectSrc = [
  "'self'",
  'https://*.supabase.co',
  'wss://*.supabase.co',
  'https://*.posthog.com',
  'https://*.i.posthog.com',
  'https://*.ingest.sentry.io',
]
if (isPreviewDeployment) connectSrc.push('https://vercel.live')
// The local Supabase stack (`supabase start`) is served over http on a loopback
// port, which `*.supabase.co` does not cover — so in development the browser
// client cannot reach it and every sign-in, query, and realtime socket is blocked
// by CSP. Allow the loopback origins in dev only; production never sees them.
if (isDev) {
  connectSrc.push(
    'http://127.0.0.1:54321',
    'ws://127.0.0.1:54321',
    'http://localhost:54321',
    'ws://localhost:54321'
  )
}

const frameSrc = ["'self'"]
if (isPreviewDeployment) frameSrc.push('https://vercel.live')

const CSP = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(' ')}`,
  // Tailwind injects styles inline; no external stylesheet origins are permitted.
  "style-src 'self' 'unsafe-inline'",
  // Self-hosted only. No third-party font origins.
  "font-src 'self'",
  // data: and blob: cover client-side image compression previews before upload.
  "img-src 'self' data: blob: https:",
  `connect-src ${connectSrc.join(' ')}`,
  `frame-src ${frameSrc.join(' ')}`,
  "worker-src 'self' blob:",
  "media-src 'self' https://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Stronger than X-Frame-Options and not overridden by it in modern browsers.
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  // Retained for browsers that predate frame-ancestors support.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // camera is allowed on self: KYC and portfolio upload use capture on mobile.
    value:
      'camera=(self), microphone=(), geolocation=(self), payment=(self), usb=(), interest-cohort=()',
  },
  // Isolates this origin from cross-origin window references.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

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

  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }]
  },

  images: {
    remotePatterns: [
      // Supabase Storage — professional portfolios, avatars, catalogue posts.
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Google OAuth profile pictures.
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      //
      // NOT carried over from V1: images.unsplash.com and i.pravatar.cc, which served
      // placeholder professionals and fake avatars. V2 does not render invented supply
      // — the catalogue degrades below its threshold instead of inventing content
      // (v2/03 §3.6). Allowing those origins would make it easy to reintroduce.
    ],
  },
}

export default nextConfig
