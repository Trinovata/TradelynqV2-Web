import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'Page not found',
}

/**
 * 404 (copy-public.md §16).
 *
 * Offers a way onward rather than an apology. Someone who hits a dead link on a
 * marketplace is usually still looking for the thing they came for, so the
 * primary action is search, not "go home".
 *
 * No emoji — V1's 404 had one, and the anti-slop covenant removed it.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-display-lg text-foreground">We can&rsquo;t find that page</h1>
      <p className="text-muted text-pretty">
        The link may be broken or the page may have moved. Try searching for what you need.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/search">Browse professionals</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Back to TradeLynq</Link>
        </Button>
      </div>
    </main>
  )
}
