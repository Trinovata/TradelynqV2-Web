import Link from 'next/link'
import { Toaster } from '@/components/ui/Toast'

/**
 * Onboarding shell (playbook S107, spec `v2/05 §5.2`).
 *
 * Deliberately outside the `(professional)` route group. That group's layout
 * calls `requireProfessional()`, which fails for exactly the person this page
 * exists to serve — someone who has no storefront yet. Onboarding also wants
 * the full width for its split-screen live preview, which the workspace rail
 * would eat into.
 *
 * The chrome is a thin bar and nothing else: no navigation, because every link
 * out of here is a professional who did not finish signing up.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="border-border bg-card/80 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-display-sm text-foreground" aria-label="TradeLynq home">
            TradeLynq
          </Link>
          <Link
            href="/support"
            className="text-muted hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            Need help?
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>
      <Toaster />
    </div>
  )
}
