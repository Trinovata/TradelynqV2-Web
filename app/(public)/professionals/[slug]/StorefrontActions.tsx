'use client'

/**
 * The storefront's action rail — the customer gate gauntlet (playbook S083,
 * flow v2/08 §8.1, copy copy-public.md §5.9–§5.12).
 *
 * Where intent turns into contact. Desktop: a sticky card following the reader
 * down the page. Mobile: a fixed 56px bottom bar, thumb-reachable, safe-area
 * padded (§5.9). Either way this is the ONE place contact details live, and
 * they arrive only from the server after a verified reveal — the unrevealed
 * rows below are presentational dummies, never blurred real data (D13:
 * "contact data is API-redacted … never merely blurred").
 *
 * ## The controller is a POST-and-branch, not a precomputed state machine
 *
 * The client never works out which gate applies. It POSTs /api/connections and
 * branches on the taxonomy code — the server's error codes ARE the state
 * machine (§18 map):
 *
 *   signed out            → /login?next={here}&reveal=1 (resume after)
 *   LEGAL_ACCEPTANCE_…    → LegalAcceptanceModal inline → accepted → retry POST
 *   KYC_REQUIRED          → KycGateSheet (kyc_prompted is emitted server-side)
 *   NOT_FOUND / CONFLICT  → listing-unavailable state with search suggestion
 *   200                   → revealed · toast "Contact details unlocked."
 *                           (reveal_completed is emitted server-side)
 *
 * `?reveal=1` on load with a signed-in customer auto-triggers the gauntlet and
 * scrolls the rail into view — the honest implementation of 8.1's "return to
 * exact scroll position" (the exact pixel offset does not survive a full
 * login round-trip; the resumed ACTION is what matters).
 *
 * RP1 (guest-enquiry path) deferred — not locked by the experience-definer;
 * this is the classic gate per v2/08 §8.1.
 *
 * SaveButton (S084) mounts in the desktop rail below "Request a quote" (§3.4:
 * quote · save · share). The mobile bottom bar spec (§5.9) lists only reveal +
 * quote, so the mobile save mount lives in the page's identity header instead.
 * ShareSheet remains deferred.
 */
import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
// AtSign stands in for Instagram: this lucide-react version ships no brand
// icons. The visible label (`View Instagram`, §5.9) carries the meaning; the
// icon is aria-hidden decoration either way.
import { AtSign, Globe, Lock, MessageCircle, Phone, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { LegalAcceptanceModal } from '@/components/shared/LegalAcceptanceModal'
import { SaveButton } from '@/components/shared/SaveButton'
import { formatTTD, formatPhone, normalisePhone } from '@/lib/utils/format'
import { whatsappLink } from '@/lib/whatsapp'
import { loginRedirect } from '@/lib/routes'
import { track } from '@/lib/analytics/events'
import { STOREFRONT_COPY } from '@/lib/copy/storefront'
import { EnquiryForm } from './EnquiryForm'
import { KycGateSheet } from './KycGateSheet'

const COPY = STOREFRONT_COPY

export type ContactInfo = { phone: string | null; whatsapp: string | null }

type Props = {
  professionalId: string
  name: string
  /** Owner's first name — the rail and modal address a person (§5.9/§5.11). */
  firstName: string
  category: string | null
  fromPrice: number | null
  isSignedIn: boolean
  initialRevealed: boolean
  initialContact: ContactInfo | null
  /** Whether the viewer has already saved this professional (S084). */
  initialSaved: boolean
  connectionCount: number
  kycStatus: string | null
  websiteUrl: string | null
  instagramHandle: string | null
}

/** External links may be stored without a protocol; a bare host needs one. */
function externalHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

// `category` stays in Props for the page's call site.
export function StorefrontActions({
  professionalId,
  name,
  firstName,
  fromPrice,
  isSignedIn,
  initialRevealed,
  initialContact,
  initialSaved,
  connectionCount: initialConnectionCount,
  websiteUrl,
  instagramHandle,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const [revealed, setRevealed] = React.useState(initialRevealed)
  const [contact, setContact] = React.useState<ContactInfo | null>(initialContact)
  const [connectionCount, setConnectionCount] = React.useState(initialConnectionCount)
  const [revealing, setRevealing] = React.useState(false)
  const [unavailable, setUnavailable] = React.useState(false)

  const [enquiryOpen, setEnquiryOpen] = React.useState(false)
  const [legalOpen, setLegalOpen] = React.useState(false)
  const [legalMissing, setLegalMissing] = React.useState<string[]>([])
  const [kycOpen, setKycOpen] = React.useState(false)

  // The action the legal gate interrupted, resumed verbatim on acceptance —
  // 8.1's "legal-accept API failure → modal retry, action preserved".
  const pendingRetry = React.useRef<(() => void) | null>(null)
  const railRef = React.useRef<HTMLDivElement>(null)

  const openLegal = React.useCallback((missing: string[], retry: () => void) => {
    // The 403's details name what is outstanding; a malformed response without
    // them falls back to the full customer contact set (CUSTOMER_CONTACT_LEGAL
    // server-side) rather than POSTing an empty acceptance.
    setLegalMissing(missing.length > 0 ? missing : ['privacy', 'terms', 'reviews'])
    pendingRetry.current = retry
    setLegalOpen(true)
  }, [])

  const goToLogin = React.useCallback(
    (resumeReveal: boolean) => {
      // `next` stays a path (loginRedirect refuses full URLs — no open redirect).
      const search = window.location.search
      const withResume = resumeReveal ? (search ? `${search}&reveal=1` : '?reveal=1') : search
      router.push(loginRedirect(pathname, withResume))
    },
    [router, pathname]
  )

  // Self-reference through a ref so the legal modal's retry closure always
  // invokes the CURRENT reveal, not a stale render's.
  const revealRef = React.useRef<() => void>(() => {})

  const reveal = React.useCallback(async () => {
    if (revealing || revealed || unavailable) return
    track('reveal_clicked', { professional_id: professionalId })

    if (!isSignedIn) {
      // Sign-in is the honest first step of the gate; ?reveal=1 resumes it here.
      goToLogin(true)
      return
    }

    setRevealing(true)
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ professional_id: professionalId }),
      })

      if (res.ok) {
        const json = (await res.json().catch(() => null)) as {
          data?: { contact?: ContactInfo; connection_count?: number }
        } | null
        setRevealed(true)
        setContact(json?.data?.contact ?? null)
        if (typeof json?.data?.connection_count === 'number') {
          setConnectionCount(json.data.connection_count)
        }
        toast(COPY.states.revealToast, { kind: 'success' })
        // reveal_completed is server-layer (EMISSION_LAYER) — the API emitted it.
        return
      }

      const json = (await res.json().catch(() => ({}))) as {
        code?: string
        details?: { missingDocuments?: string[] }
      }
      switch (json.code) {
        case 'UNAUTHENTICATED':
          goToLogin(true)
          return
        case 'LEGAL_ACCEPTANCE_REQUIRED':
          openLegal(json.details?.missingDocuments ?? [], () => revealRef.current())
          return
        case 'KYC_REQUIRED':
          // kyc_prompted is emitted server-side alongside this 403.
          setKycOpen(true)
          return
        case 'NOT_FOUND':
        case 'CONFLICT_STATE':
          // 8.1: "professional suspends mid-session → reveal returns
          // 404-equivalent with search suggestion".
          setUnavailable(true)
          return
        case 'RATE_LIMITED':
          toast(COPY.errors.rateLimited, { kind: 'error' })
          return
        default:
          toast(COPY.errors.internal, { kind: 'error' })
      }
    } catch {
      toast(COPY.errors.internal, { kind: 'error' })
    } finally {
      setRevealing(false)
    }
  }, [revealing, revealed, unavailable, isSignedIn, professionalId, goToLogin, openLegal])

  React.useEffect(() => {
    revealRef.current = () => void reveal()
  }, [reveal])

  // ?reveal=1 resume — see the header comment. Read from window.location rather
  // than useSearchParams so the (dynamic) page needs no Suspense boundary.
  const autoTriggered = React.useRef(false)
  React.useEffect(() => {
    if (autoTriggered.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('reveal') !== '1') return
    autoTriggered.current = true
    // Strip the flag so a refresh does not re-fire the gauntlet.
    params.delete('reveal')
    const rest = params.toString()
    router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false })
    if (!isSignedIn || initialRevealed) return
    railRef.current?.scrollIntoView({ block: 'center' })
    revealRef.current()
  }, [router, pathname, isSignedIn, initialRevealed])

  const openEnquiry = React.useCallback(() => {
    if (!isSignedIn) {
      // §5.10: signed-out reveal/enquiry both route to login, `next` preserved.
      goToLogin(false)
      return
    }
    setEnquiryOpen(true)
  }, [isSignedIn, goToLogin])

  // Enquiry success auto-creates the connection (8.1: one gate, not two) —
  // flip the rail immediately, then refresh so server truth catches up.
  const handleEnquirySuccess = React.useCallback(
    (revealedContact: ContactInfo | null) => {
      setRevealed(true)
      if (revealedContact) setContact(revealedContact)
      router.refresh()
    },
    [router]
  )

  const waHref = contact
    ? whatsappLink(contact.whatsapp ?? contact.phone ?? '', 'storefront_intro', {
        name: firstName,
      })
    : null
  const telDigits = contact?.phone ? normalisePhone(contact.phone) : null

  const trackWhatsApp = React.useCallback(() => {
    track('whatsapp_clicked', { context: 'storefront', counterparty_id: professionalId })
  }, [professionalId])

  // §5.9: the free-reveal note. The deck defines strings for counts 0 and 1
  // only; at 2+ (or once revealed) no note renders.
  const freeNote = revealed
    ? null
    : connectionCount <= 0
      ? COPY.rail.freeRevealsNote
      : connectionCount === 1
        ? COPY.rail.lastFreeNote
        : null

  const unavailableState = (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <SearchX className="text-muted size-8" aria-hidden="true" />
      <p className="text-foreground font-medium">{COPY.states.unavailableHeading}</p>
      <p className="text-muted text-sm text-pretty">{COPY.states.unavailableBody}</p>
      <Button asChild variant="secondary">
        <Link href="/search">{COPY.states.unavailableAction}</Link>
      </Button>
    </div>
  )

  const revealedRows = contact && (
    <div className="flex flex-col gap-2">
      {waHref && (
        <Button asChild fullWidth>
          <a href={waHref} target="_blank" rel="noreferrer" onClick={trackWhatsApp}>
            <MessageCircle className="size-4" aria-hidden="true" />
            {COPY.rail.whatsapp}
          </a>
        </Button>
      )}
      {contact.phone && telDigits && (
        <a
          href={`tel:+${telDigits}`}
          className="text-foreground hover:bg-card-subtle focus-visible:outline-ring inline-flex min-h-10 items-center gap-2 rounded-[--radius-control] px-2 font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Phone className="text-muted size-4" aria-hidden="true" />
          {formatPhone(contact.phone)}
        </a>
      )}
      {websiteUrl && (
        <a
          href={externalHref(websiteUrl)}
          target="_blank"
          rel="noreferrer"
          className="text-body hover:text-foreground focus-visible:outline-ring inline-flex min-h-10 items-center gap-2 rounded-[--radius-control] px-2 text-sm transition-[color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Globe className="text-muted size-4" aria-hidden="true" />
          {COPY.rail.website}
        </a>
      )}
      {instagramHandle && (
        <a
          href={`https://instagram.com/${instagramHandle.replace(/^@/, '')}`}
          target="_blank"
          rel="noreferrer"
          className="text-body hover:text-foreground focus-visible:outline-ring inline-flex min-h-10 items-center gap-2 rounded-[--radius-control] px-2 text-sm transition-[color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <AtSign className="text-muted size-4" aria-hidden="true" />
          {COPY.rail.instagram}
        </a>
      )}
    </div>
  )

  const unrevealedRows = (
    <>
      {/* Presentational dummies — the payload carries no contact pre-reveal
          (D13), so there is nothing real here to blur. */}
      <div aria-hidden="true" className="flex flex-col gap-2">
        {[Phone, MessageCircle].map((Icon, index) => (
          <div key={index} className="flex min-h-8 items-center gap-2 px-2">
            <Icon className="text-muted size-4" />
            <span className="bg-border/70 h-3 w-36 rounded-full blur-[3px]" />
          </div>
        ))}
      </div>
      <Button fullWidth onClick={() => void reveal()} isLoading={revealing}>
        {COPY.rail.reveal}
      </Button>
      {freeNote && <p className="text-muted text-center text-xs">{freeNote}</p>}
    </>
  )

  return (
    <>
      {/* Desktop: sticky card */}
      <aside className="hidden lg:block">
        <div
          ref={railRef}
          className="border-border bg-card sticky top-24 flex flex-col gap-4 rounded-[--radius-card] border p-5"
        >
          {unavailable ? (
            unavailableState
          ) : (
            <>
              {fromPrice !== null && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-muted text-sm">from</span>
                  <span className="text-foreground font-mono text-xl font-medium tabular-nums">
                    {formatTTD(fromPrice)}
                  </span>
                </div>
              )}

              <h2 className="text-foreground flex items-center gap-2 font-medium">
                {!revealed && <Lock className="text-muted size-4" aria-hidden="true" />}
                {COPY.rail.heading(firstName)}
              </h2>

              {revealed && contact ? revealedRows : unrevealedRows}

              <Button variant="secondary" fullWidth onClick={openEnquiry}>
                {COPY.rail.requestQuote}
              </Button>
              {/* §3.4 rail order: quote · save · share. ShareSheet mounts
                  beside this when it lands. */}
              <div className="flex justify-center">
                <SaveButton
                  professionalId={professionalId}
                  name={name}
                  isSignedIn={isSignedIn}
                  initialSaved={initialSaved}
                />
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Mobile: fixed 56px bottom bar (§5.9), above the site's bottom nav */}
      <div className="border-border bg-background/95 fixed inset-x-0 bottom-14 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3">
          {unavailable ? (
            <Button asChild variant="secondary" fullWidth>
              <Link href="/search">{COPY.states.unavailableAction}</Link>
            </Button>
          ) : (
            <>
              {revealed && waHref ? (
                <Button asChild fullWidth>
                  <a href={waHref} target="_blank" rel="noreferrer" onClick={trackWhatsApp}>
                    <MessageCircle className="size-4" aria-hidden="true" />
                    {COPY.rail.whatsapp}
                  </a>
                </Button>
              ) : (
                <Button fullWidth onClick={() => void reveal()} isLoading={revealing}>
                  <Lock className="size-4" aria-hidden="true" />
                  {COPY.rail.mobileReveal}
                </Button>
              )}
              <Button variant="secondary" className="shrink-0" onClick={openEnquiry}>
                {COPY.rail.requestQuote}
              </Button>
            </>
          )}
        </div>
      </div>

      <EnquiryForm
        open={enquiryOpen}
        onOpenChange={setEnquiryOpen}
        professionalId={professionalId}
        firstName={firstName}
        onLegalRequired={openLegal}
        onKycRequired={() => setKycOpen(true)}
        onSuccess={handleEnquirySuccess}
      />

      <LegalAcceptanceModal
        open={legalOpen}
        onOpenChange={setLegalOpen}
        missingDocuments={legalMissing}
        onAccepted={() => {
          const retry = pendingRetry.current
          pendingRetry.current = null
          retry?.()
        }}
      />

      <KycGateSheet open={kycOpen} onOpenChange={setKycOpen} />
    </>
  )
}
