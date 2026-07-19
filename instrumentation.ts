/**
 * Server and edge instrumentation. Runs once per runtime at server start.
 *
 * Two jobs: fail the boot if a production deployment is missing protections it cannot
 * safely run without, and initialise Sentry where a DSN exists.
 *
 * The environment assertion runs FIRST and deliberately outside the try/catch — if a
 * production deployment lacks its rate-limiter or webhook credentials, we want the
 * process to die noisily rather than serve traffic with those protections off.
 */
import { assertProductionEnv } from '@/lib/env'

export async function register() {
  assertProductionEnv()

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) {
    // Expected until playbook S004 provisions the Sentry project. Error reporting is
    // absent, not broken — the app runs fine without it.
    return
  }

  const Sentry = await import('@sentry/nextjs')

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,

    // 10% in production keeps the trace bill bounded while still surfacing patterns;
    // everything locally, where volume is trivial and detail is what you want.
    tracesSampleRate: process.env.VERCEL_ENV === 'production' ? 0.1 : 1.0,

    // This platform handles identity documents, phone numbers, and payment state.
    // Default PII capture is off and stays off.
    sendDefaultPii: false,

    beforeSend(event) {
      // Defence in depth: strip anything that could carry a token or a document URL
      // even if some future call site attaches it by accident.
      if (event.request?.headers) {
        delete event.request.headers.authorization
        delete event.request.headers.cookie
        delete event.request.headers['x-cron-secret']
      }
      if (event.request?.cookies) delete event.request.cookies
      return event
    },
  })
}

/**
 * Captures errors thrown in nested React Server Components, which do not otherwise
 * reach Sentry.
 */
export async function onRequestError(
  ...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>
) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureRequestError(...args)
}
