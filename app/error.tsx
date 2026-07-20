'use client'

import * as React from 'react'
import { Button } from '@/components/ui/Button'

/**
 * Route-level error boundary (copy-public.md §16).
 *
 * Deliberately shows NOTHING about the error. `error.message` on a server-thrown
 * exception can carry a database error, a file path, or a query fragment, and
 * this component renders to whoever triggered it. The digest is enough to find
 * the corresponding Sentry event.
 *
 * "We've been notified" is only true because the reporting below actually runs —
 * a reassurance the product does not deliver is worse than none.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    // Dynamic import so Sentry is not in the bundle of every page that merely
    // *might* error — which is all of them.
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error))
    }
  }, [error])

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-display-lg text-foreground">Something went wrong on our end</h1>
      <p className="text-muted text-pretty">
        We&rsquo;ve been notified and we&rsquo;re looking into it. Try again in a moment.
      </p>

      <div className="mt-2">
        <Button onClick={reset}>Try again</Button>
      </div>

      {error.digest && (
        // Shown so a user can quote it to support, which turns an unreproducible
        // report into a searchable one. It is an opaque hash, not a leak.
        <p className="text-muted font-mono text-xs">Reference: {error.digest}</p>
      )}
    </main>
  )
}
