'use client'

/**
 * Step 1 — Business basics (spec `v2/05 §5.2`, copy `copy-professional.md §4.1`).
 *
 * The step that decides whether a professional is findable at all: the category
 * and the service areas are the two facts every search query filters on. So the
 * pickers are the substance of this file, and the plain text fields are almost
 * incidental.
 *
 * Validation is shown on blur and on a blocked Continue, never on the first
 * keystroke — telling someone their name is too short while they are typing it
 * is the classic form insult.
 */
import * as React from 'react'
import { Input } from '@/components/ui/Input'
import { useOnboarding } from '../context'
import { StepActions } from '../OnboardingWizard'
import { CategoryPicker } from '../CategoryPicker'
import { AreaPicker } from '../AreaPicker'
import { CredentialUpload } from '../CredentialUpload'
import { stepSchemas } from '@/lib/professional/onboarding'

export function StepBasics() {
  const { draft, update, setStep, subtype } = useOnboarding()
  const [touched, setTouched] = React.useState<Record<string, boolean>>({})
  const [showAll, setShowAll] = React.useState(false)

  const result = stepSchemas[1].safeParse(draft)
  const fieldErrors = result.success ? {} : result.error.flatten().fieldErrors

  const errorFor = (field: keyof typeof fieldErrors) =>
    (showAll || touched[field]) && fieldErrors[field] ? fieldErrors[field]?.[0] : undefined

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-md text-foreground">Tell us about your business</h1>
        <p className="text-muted text-sm">
          This is what customers see first when your page appears in search.
        </p>
      </header>

      <Input
        label="Business name"
        hint="What customers will see. Use your trading name if you have one."
        placeholder="Persad Plumbing"
        value={draft.businessName}
        maxLength={80}
        required
        error={errorFor('businessName')}
        onBlur={() => setTouched((t) => ({ ...t, businessName: true }))}
        onChange={(event) => update({ businessName: event.target.value })}
      />

      <Input
        label="Your name"
        hint="The person behind the business. Shown as the contact."
        placeholder="Anand Persad"
        autoComplete="name"
        value={draft.ownerName}
        maxLength={120}
        required
        error={errorFor('ownerName')}
        onBlur={() => setTouched((t) => ({ ...t, ownerName: true }))}
        onChange={(event) => update({ ownerName: event.target.value })}
      />

      <CategoryPicker
        value={draft.categoryId}
        onChange={(categoryId) => update({ categoryId })}
        error={errorFor('categoryId')}
      />

      <AreaPicker
        value={draft.serviceAreas}
        onChange={(serviceAreas) => update({ serviceAreas })}
        error={errorFor('serviceAreas')}
      />

      <Input
        label="Years of experience"
        hint="Optional. Builds trust with new customers."
        type="number"
        inputMode="numeric"
        min={0}
        max={70}
        placeholder="8"
        className="font-mono tabular-nums"
        value={draft.yearsExperience ?? ''}
        error={errorFor('yearsExperience')}
        onBlur={() => setTouched((t) => ({ ...t, yearsExperience: true }))}
        onChange={(event) =>
          update({
            yearsExperience: event.target.value === '' ? null : Number(event.target.value),
          })
        }
      />

      {/* Subtype add-ons. Which document is asked for is a consequence of the
          account type chosen at role selection, not a question asked twice. */}
      {subtype === 'student_entrepreneur' && (
        <CredentialUpload
          label="Student ID or proof of enrolment"
          hint="We verify students by hand before your page goes live. This keeps the student rate honest."
          note="Under 18? We’ll also need a parent or guardian to confirm consent before approval."
          value={draft.subtypeDocUrl}
          onChange={(subtypeDocUrl) => update({ subtypeDocUrl })}
        />
      )}

      {subtype === 'registered_business' && (
        <div className="flex flex-col gap-5">
          <CredentialUpload
            label="Certificate of Incorporation (or your BIR number)"
            hint="We check this against the Companies Registry before granting your Registered badge."
            value={draft.subtypeDocUrl}
            onChange={(subtypeDocUrl) => update({ subtypeDocUrl })}
          />
          <Input
            label="BIR number"
            hint="Optional if you uploaded your certificate."
            value={draft.birNumber}
            maxLength={40}
            onChange={(event) => update({ birNumber: event.target.value })}
          />
        </div>
      )}

      <StepActions
        forwardLabel="Continue"
        onForward={() => {
          if (!result.success) {
            setShowAll(true)
            return
          }
          setStep(2)
        }}
      />
    </section>
  )
}
