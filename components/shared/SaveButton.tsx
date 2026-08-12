'use client'

/**
 * SaveButton — the shortlist toggle (playbook S084, copy copy-public.md
 * §5.9/§5.12, spec v2/03 §3.4).
 *
 * Optimistic: the heart flips on press (M9 in place), then reconciles with the
 * server's answer — a failed POST flips it back rather than lying. Toggle
 * truth is the POST /api/saved response, never local arithmetic.
 *
 * Signed-out → route to login with `next` preserved (§5.12 / §18
 * UNAUTHENTICATED). `save_toggled` is client-layer per analytics-events.md, so
 * it is emitted here on the server-confirmed state.
 *
 * Deck §5.9 defines the save affordance as aria-label only (`Save {name}`) —
 * an icon button, no visible label. `aria-pressed` carries the toggle state to
 * assistive tech; the filled heart carries it visually.
 */
import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { loginRedirect } from '@/lib/routes'
import { track } from '@/lib/analytics/events'
import { cn } from '@/lib/utils/cn'
import { STOREFRONT_COPY } from '@/lib/copy/storefront'

const COPY = STOREFRONT_COPY

type Props = {
  professionalId: string
  /** Display name, for the aria-label `Save {name}` (§5.9). */
  name: string
  isSignedIn: boolean
  initialSaved: boolean
  className?: string
}

export function SaveButton({ professionalId, name, isSignedIn, initialSaved, className }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const [saved, setSaved] = React.useState(initialSaved)
  // In flight, not disabled: a second press queues nothing but is not ignored
  // rudely — it simply re-runs once the first settles via the saved state.
  const inFlight = React.useRef(false)

  const toggle = React.useCallback(async () => {
    if (!isSignedIn) {
      // §5.12: save while signed-out routes to login, `next` preserved.
      router.push(loginRedirect(pathname, window.location.search))
      return
    }
    if (inFlight.current) return
    inFlight.current = true

    // Optimistic flip; the response reconciles it below.
    const optimistic = !saved
    setSaved(optimistic)

    try {
      const res = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ professional_id: professionalId }),
      })

      if (res.ok) {
        const json = (await res.json().catch(() => null)) as {
          data?: { saved?: boolean }
        } | null
        const confirmed = json?.data?.saved ?? optimistic
        setSaved(confirmed)
        track('save_toggled', { professional_id: professionalId, on: confirmed })
        if (confirmed) {
          toast(COPY.states.savedToast, {
            kind: 'success',
            action: { label: COPY.states.savedToastAction, onClick: () => router.push('/saved') },
          })
        } else {
          toast(COPY.states.removedToast, { kind: 'info' })
        }
        return
      }

      // Reconcile: the flip did not happen.
      setSaved(!optimistic)
      const json = (await res.json().catch(() => ({}))) as { code?: string }
      switch (json.code) {
        case 'UNAUTHENTICATED':
          router.push(loginRedirect(pathname, window.location.search))
          return
        case 'RATE_LIMITED':
          toast(COPY.errors.rateLimited, { kind: 'error' })
          return
        default:
          toast(COPY.errors.internal, { kind: 'error' })
      }
    } catch {
      setSaved(!optimistic)
      toast(COPY.errors.internal, { kind: 'error' })
    } finally {
      inFlight.current = false
    }
  }, [isSignedIn, saved, professionalId, router, pathname])

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-label={COPY.rail.saveAria(name)}
      aria-pressed={saved}
      className={cn(
        'text-muted hover:text-foreground inline-flex size-10 shrink-0 items-center justify-center',
        'rounded-[--radius-control]',
        // M9 (statusMorph): the state change happens in place — transform only.
        'transition-transform duration-150 ease-in-out active:scale-90',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        // Saved state renders in accent — DESIGN.md: accent is the ONLY
        // interactive colour; destructive is for declined/cancelled/overdue.
        saved && 'text-accent-ink hover:text-accent-ink',
        className
      )}
    >
      <Heart className={cn('size-5', saved && 'fill-current')} aria-hidden="true" />
    </button>
  )
}
