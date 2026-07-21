'use client'

/**
 * The storefront's action rail (playbook S081).
 *
 * Where intent turns into contact. On desktop it is a sticky card that follows
 * the reader down the page; on mobile it is a fixed bottom bar, thumb-reachable,
 * safe-area padded. Either way it is the one place the contact details live —
 * and they are NOT here yet, by design.
 *
 * The reveal gate (S083) is the real mechanism: a signed-out visitor who taps
 * "Show contact" will be walked through sign-in → legal acceptance → the
 * two-free-contacts gate, and only then does the server hand over the number.
 * Until that flow lands, this renders the CTA that will trigger it and is honest
 * about what happens next — never a disabled dead end, never a fake number.
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatTTD } from '@/lib/utils/format'

type Props = {
  name: string
  category: string | null
  fromPrice: number | null
}

export function StorefrontActions({ name, category, fromPrice }: Props) {
  const router = useRouter()

  // The reveal gate is not built yet (S083). Sending the visitor to sign in is
  // the honest first step of that flow — the gate resumes there — rather than a
  // greyed-out button that pretends the feature is coming later.
  const reveal = React.useCallback(() => {
    const next = typeof window !== 'undefined' ? window.location.pathname : '/'
    router.push(`/login?next=${encodeURIComponent(next)}`)
  }, [router])

  return (
    <>
      {/* Desktop: sticky card */}
      <aside className="hidden lg:block">
        <div className="border-border bg-card sticky top-24 flex flex-col gap-4 rounded-[--radius-card] border p-5">
          {fromPrice !== null && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-muted text-sm">from</span>
              <span className="text-foreground font-mono text-xl font-medium tabular-nums">
                {formatTTD(fromPrice)}
              </span>
            </div>
          )}

          <Button fullWidth onClick={reveal}>
            <MessageCircle className="size-4" aria-hidden="true" />
            Chat on WhatsApp
          </Button>

          <button
            type="button"
            onClick={reveal}
            className="text-muted hover:text-foreground focus-visible:outline-ring inline-flex items-center justify-center gap-1.5 text-sm transition-[color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Lock className="size-3.5" aria-hidden="true" />
            Show contact details
          </button>

          <p className="text-muted border-border border-t pt-3 text-center text-xs">
            Sign in to reach {category ? `this ${category.toLowerCase()}` : name}. Your first two
            contacts are free.
          </p>
        </div>
      </aside>

      {/* Mobile: fixed bottom bar, above the site's own bottom nav */}
      <div className="border-border bg-background/95 fixed inset-x-0 bottom-14 z-30 border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          {fromPrice !== null && (
            <div className="flex shrink-0 flex-col leading-tight">
              <span className="text-muted text-xs">from</span>
              <span className="text-foreground font-mono text-sm font-medium tabular-nums">
                {formatTTD(fromPrice)}
              </span>
            </div>
          )}
          <Button fullWidth onClick={reveal}>
            <MessageCircle className="size-4" aria-hidden="true" />
            Chat on WhatsApp
          </Button>
        </div>
      </div>
    </>
  )
}
