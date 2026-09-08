'use client'

/**
 * The onboarding wizard (playbook S107, spec `v2/05 §5.2`, copy
 * `copy-professional.md §4`).
 *
 * Five steps, each its own component — the spec's first instruction is that
 * "the 1,200-line monolith dies", and the way to keep it dead is that no step
 * can see another step's internals. They share a draft through context and
 * nothing else.
 *
 * Layout: form left (55%) / live preview right (45%) on desktop; on mobile the
 * preview becomes a peek-sheet behind a `See your page` pill, because a 375px
 * screen cannot hold both and the form is what the professional came to fill in.
 */
import * as React from 'react'
import { Eye } from 'lucide-react'
import { StepIndicator } from '@/components/ui/Progress'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { OnboardingProvider, useOnboarding } from './context'
import { LegalGate } from './LegalGate'
import { StorefrontPreview } from './StorefrontPreview'
import { StepBasics } from './steps/StepBasics'
import { StepAbout } from './steps/StepAbout'
import { StepServices } from './steps/StepServices'
import { StepProof } from './steps/StepProof'
import { StepPublish } from './steps/StepPublish'
import { ONBOARDING_STEPS, resumeStep } from '@/lib/professional/onboarding'
import type { OnboardingContext } from '@/lib/professional/onboarding-server'
import { formatDate } from '@/lib/utils/format'

export function OnboardingWizard({
  context,
  subtype,
  missingLegal,
  userId,
}: {
  context: OnboardingContext
  subtype: 'student_entrepreneur' | 'sole_trader' | 'registered_business' | null
  missingLegal: string[]
  userId: string
}) {
  // Resume where the work actually stopped, not at the highest step number
  // reached: a professional who got to step 4 and then cleared their bio should
  // land back on the bio, not on a step they cannot publish from.
  const initialStep = Math.min(context.savedStep, resumeStep(context.draft))

  return (
    <OnboardingProvider
      initialDraft={context.draft}
      initialStep={initialStep}
      categories={context.categories}
      subtype={subtype}
      userId={userId}
      hasServerDraft={context.professionalId !== null}
    >
      <LegalGate missingDocuments={missingLegal} />
      <WizardBody slug={context.slug} />
    </OnboardingProvider>
  )
}

function WizardBody({ slug }: { slug: string | null }) {
  const { draft, categories, subtype, step, saveState, restoredAt, dismissRestoreNote } =
    useOnboarding()
  const [previewOpen, setPreviewOpen] = React.useState(false)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <StepIndicator steps={[...ONBOARDING_STEPS]} current={step} className="min-w-0 flex-1" />
        {/* The autosave note, top-right per the deck. `aria-live` polite so it
            is announced once rather than fighting the field being typed in. */}
        <span aria-live="polite" className="text-muted shrink-0 pt-0.5 text-xs">
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'Saved'}
          {saveState === 'error' && <span className="text-destructive">Couldn’t save</span>}
        </span>
      </div>

      {restoredAt && (
        <div className="border-border bg-card-subtle mb-6 flex items-center justify-between gap-4 rounded-[--radius-control] border p-3">
          <p className="text-body text-sm">We saved your progress from {formatDate(restoredAt)}.</p>
          <button
            type="button"
            onClick={dismissRestoreNote}
            className="text-muted hover:text-foreground shrink-0 text-xs underline-offset-4 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[55fr_45fr]">
        <div className="min-w-0">
          {step === 1 && <StepBasics />}
          {step === 2 && <StepAbout />}
          {step === 3 && <StepServices />}
          {step === 4 && <StepProof />}
          {step === 5 && <StepPublish slug={slug} />}
        </div>

        {/* Desktop preview. Sticky, because the form is taller than the panel
            and a preview that scrolls away stops being live. */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <p className="text-muted mb-2 text-xs">Your storefront, as customers will see it</p>
            <StorefrontPreview draft={draft} categories={categories} subtype={subtype} />
          </div>
        </aside>
      </div>

      {/* Mobile peek-sheet pill (M6). Fixed above the step's own action row so
          it never covers Continue. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-20 flex justify-center lg:hidden">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPreviewOpen(true)}
          className="shadow-e2 pointer-events-auto"
        >
          <Eye className="size-4" aria-hidden="true" />
          See your page
        </Button>
      </div>

      <Sheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        height="full"
        title="Your storefront"
        description="A live preview of the page customers will see."
      >
        <StorefrontPreview draft={draft} categories={categories} subtype={subtype} />
      </Sheet>
    </div>
  )
}

/**
 * The shared footer every step ends with: Back, the step's own forward label,
 * and an optional skip.
 *
 * Forward always flushes the pending autosave first. Without that, tapping
 * Continue the instant after typing can advance past a step whose last keystroke
 * never reached the server — and on step 5 that means publishing a storefront
 * missing the field that was just filled in.
 */
export function StepActions({
  forwardLabel,
  onForward,
  canGoForward = true,
  onSkip,
  skipLabel,
  busy = false,
}: {
  forwardLabel: string
  onForward: () => void | Promise<void>
  canGoForward?: boolean
  onSkip?: () => void
  skipLabel?: string
  busy?: boolean
}) {
  const { step, setStep, flush } = useOnboarding()
  const [working, setWorking] = React.useState(false)

  async function forward() {
    setWorking(true)
    try {
      await flush()
      await onForward()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="border-border mt-8 flex items-center gap-3 border-t pt-6">
      {step > 1 && (
        <Button variant="ghost" onClick={() => setStep(step - 1)}>
          Back
        </Button>
      )}
      <div className="flex-1" />
      {onSkip && skipLabel && (
        <button
          type="button"
          onClick={onSkip}
          className="text-muted hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          {skipLabel}
        </button>
      )}
      <Button onClick={forward} disabled={!canGoForward} isLoading={working || busy}>
        {forwardLabel}
      </Button>
    </div>
  )
}
