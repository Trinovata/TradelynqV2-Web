'use client'

/**
 * Step 5 — Plan & publish (spec `v2/05 §5.2`, copy `copy-professional.md §4.5`).
 *
 * ## Why there is no checkout here
 *
 * The deck's step 5 ends at "Continue to payment → Stripe checkout". D62
 * (launch pricing) removed that: subscriptions are free through the launch
 * window, Stripe is deferred to roughly February 2027, and the registration fee
 * is collected off-app (WiPay link or recorded by an admin). So publish submits
 * for review, and the price summary tells the professional exactly what they
 * will owe and when — which is the honest version of the same screen. When
 * `PRICING_MODE` flips to `tiers`, the checkout handoff returns here.
 *
 * The contact number is asked for here rather than in step 1 because it is the
 * one field with a consequence at publish: a storefront with no WhatsApp is a
 * storefront no customer can reach after they pass the connection gate.
 */
import * as React from 'react'
import Link from 'next/link'
import { Check, PartyPopper, Share2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { useOnboarding } from '../context'
import { StorefrontPreview } from '../StorefrontPreview'
import { formatTTD, formatDate } from '@/lib/utils/format'
import {
  LAUNCH_PRICING,
  REGISTRATION_FEE,
  PRICING_MODE,
  launchMonthly,
  type AccountTrack,
} from '@/lib/constants/pricing'
import { isStepComplete } from '@/lib/professional/onboarding'

function trackFor(
  subtype: 'student_entrepreneur' | 'sole_trader' | 'registered_business' | null
): AccountTrack {
  if (subtype === 'student_entrepreneur') return 'student'
  if (subtype === 'registered_business') return 'registered'
  return 'sole_trader'
}

export function StepPublish({ slug }: { slug: string | null }) {
  const { draft, update, categories, subtype, setStep, flush } = useOnboarding()
  const [confirmed, setConfirmed] = React.useState(false)
  const [publishing, setPublishing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [published, setPublished] = React.useState<{ slug: string | null } | null>(null)

  const track = trackFor(subtype)
  const isStudent = track === 'student'
  const monthlyAfterFree = launchMonthly(track)
  const registration = isStudent ? REGISTRATION_FEE.student : REGISTRATION_FEE.standard

  const earlierStepsDone = [1, 2, 3].every((step) => isStepComplete(draft, step))

  async function publish() {
    setPublishing(true)
    setError(null)
    try {
      // Land the draft first. Publish validates the STORED row, so a pending
      // autosave would make it reject fields the professional can see on screen.
      await flush()

      const response = await fetch('/api/professional/onboarding/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          confirmed: true,
          seedReviews: draft.seedReviews.filter(
            (review) => review.customer_name.trim() && review.text.trim()
          ),
        }),
      })

      const body = (await response.json().catch(() => null)) as {
        data?: { slug?: string | null }
        error?: string
      } | null

      if (!response.ok) {
        setError(body?.error ?? 'That didn’t go through. Please try again.')
        return
      }

      setPublished({ slug: body?.data?.slug ?? slug })
    } catch {
      setError('That didn’t go through. Check your connection and try again.')
    } finally {
      setPublishing(false)
    }
  }

  // ── Success screen (M13) ──────────────────────────────────────────────────
  if (published) {
    const storefrontUrl = published.slug
      ? `${window.location.origin}/professionals/${published.slug}`
      : window.location.origin
    const shareText = `I just launched my TradeLynq storefront! See my work, reviews and prices: ${storefrontUrl}`

    return (
      <section className="flex flex-col items-start gap-5 py-6">
        <span className="bg-success/10 text-success rounded-full p-3">
          <PartyPopper className="size-7" aria-hidden="true" />
        </span>
        <h1 className="text-display-lg text-foreground">Your storefront is ready.</h1>
        <p className="text-body max-w-prose">
          You’re set up. Your page is now with our team for a quick review — usually under 24 hours.
          We’ll WhatsApp you the moment you’re live.
        </p>

        <Button size="lg" asChild>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Share2 className="size-5" aria-hidden="true" />
            Share on WhatsApp
          </a>
        </Button>

        <Button variant="ghost" asChild>
          <Link href="/dashboard">Go to my dashboard</Link>
        </Button>

        <p className="text-muted text-xs">Pending review — usually under 24 hours.</p>
      </section>
    )
  }

  // ── The publish step ──────────────────────────────────────────────────────
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-md text-foreground">Choose your plan and go live</h1>
        <p className="text-muted text-sm">One last look, then we send it for review.</p>
      </header>

      <Input
        label="WhatsApp number"
        hint="How customers reach you once they’ve passed the contact gate. Not shown publicly."
        type="tel"
        inputMode="tel"
        placeholder="868 000 0000"
        value={draft.contactWhatsapp}
        maxLength={40}
        onChange={(event) => update({ contactWhatsapp: event.target.value })}
      />

      {/* Full preview, in flow rather than in the rail — this is the moment to
          read the whole page, not glance at it. */}
      <div className="flex flex-col gap-2 lg:hidden">
        <span className="text-foreground text-sm font-medium">Preview my storefront</span>
        <StorefrontPreview draft={draft} categories={categories} subtype={subtype} />
      </div>

      {/* ── Price summary ── */}
      <div className="border-border bg-card flex flex-col gap-3 rounded-[--radius-card] border p-5">
        <h2 className="text-foreground font-medium">What this costs</h2>

        {PRICING_MODE === 'launch' ? (
          <>
            <p className="text-body text-sm">
              <span className="text-foreground font-medium">
                Free until {formatDate(LAUNCH_PRICING.freeUntil)}.
              </span>{' '}
              Every professional joining now has full access at no subscription charge through the
              launch window. We’ll tell you well before anything changes.
            </p>
            <ul className="text-body flex flex-col gap-2 text-sm">
              <li className="flex items-baseline justify-between gap-4">
                <span>Subscription until {formatDate(LAUNCH_PRICING.freeUntil)}</span>
                <span className="text-success shrink-0 font-mono tabular-nums">Free</span>
              </li>
              <li className="flex items-baseline justify-between gap-4">
                <span>{isStudent ? 'Student rate afterwards' : 'Monthly rate afterwards'}</span>
                <span className="text-foreground shrink-0 font-mono tabular-nums">
                  {formatTTD(monthlyAfterFree)}/month
                </span>
              </li>
              <li className="border-border flex items-baseline justify-between gap-4 border-t pt-2">
                <span>Registration fee (one-time)</span>
                <span className="text-foreground shrink-0 font-mono tabular-nums">
                  {formatTTD(registration)}
                </span>
              </li>
            </ul>
            <p className="text-muted text-xs">
              The registration fee is payable once, after your page is approved — we’ll send you a
              payment link on WhatsApp. Nothing is charged today.
            </p>
            {isStudent && (
              <p className="text-muted text-xs">
                Registered as a student, so registration is half price. Scholarship places are
                available — ask us on WhatsApp.
              </p>
            )}
          </>
        ) : (
          // The tiers regime is dormant behind PRICING_MODE. When it wakes, the
          // tier cards and the crossover summary belong here — not a second
          // pricing story invented in this component.
          <p className="text-body text-sm">Your plan is set up in your workspace after approval.</p>
        )}
      </div>

      {/* ── Confirm ── */}
      <Checkbox
        checked={confirmed}
        onCheckedChange={(value) => setConfirmed(value === true)}
        label="I confirm the details above are accurate and accept the plan terms."
      />

      {!earlierStepsDone && (
        <p className="text-destructive text-sm" role="alert">
          Some earlier steps still need finishing.{' '}
          <button type="button" onClick={() => setStep(1)} className="underline underline-offset-4">
            Go back to the start
          </button>
        </p>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <div className="border-border flex items-center gap-3 border-t pt-6">
        <Button variant="ghost" onClick={() => setStep(4)}>
          Back
        </Button>
        <div className="flex-1" />
        <Button
          size="lg"
          onClick={publish}
          disabled={!confirmed || !earlierStepsDone}
          isLoading={publishing}
          loadingLabel="Publishing…"
        >
          <Check className="size-4" aria-hidden="true" />
          Publish my storefront
        </Button>
      </div>
    </section>
  )
}
