import Link from 'next/link'

/**
 * Auth shell (spec v2/03 §3.14).
 *
 * A single card on the page background, max-w-md, centred. Deliberately without
 * the site navigation: someone signing in has one job, and a header full of
 * marketing links is an invitation to abandon it.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <Link
        href="/"
        className="text-display-sm text-foreground mb-8"
        aria-label="TradeLynq — back to home"
      >
        TradeLynq
      </Link>

      <main className="border-border bg-card w-full max-w-md rounded-[--radius-card] border p-6 sm:p-8">
        {children}
      </main>

      <p className="text-muted mt-6 text-xs">
        <Link href="/legal/privacy" className="underline-offset-4 hover:underline">
          Privacy
        </Link>
        {' · '}
        <Link href="/legal/terms" className="underline-offset-4 hover:underline">
          Terms
        </Link>
        {' · '}
        <Link href="/support" className="underline-offset-4 hover:underline">
          Support
        </Link>
      </p>
    </div>
  )
}
