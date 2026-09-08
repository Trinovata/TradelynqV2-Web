'use client'

/**
 * Step 2 — About (spec `v2/05 §5.2`, copy `copy-professional.md §4.2`).
 *
 * The photo is the magic moment: it lands in the live preview the instant it
 * uploads, and that is when the storefront stops being a form and starts being
 * theirs. The bio is the step people abandon on, which is why the drafting
 * helper sits right under the textarea rather than behind a menu.
 */
import * as React from 'react'
import { Camera, Sparkles, X } from 'lucide-react'
import Image from 'next/image'
import { Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { useOnboarding } from '../context'
import { StepActions } from '../OnboardingWizard'
import { BioDrafter } from '../BioDrafter'
import { uploadProfessionalImage, ACCEPTED_IMAGE_TYPES } from '../upload'
import { BIO_MAX, BIO_MIN, stepSchemas } from '@/lib/professional/onboarding'
import { cn } from '@/lib/utils/cn'

export function StepAbout() {
  const { draft, update, setStep, userId } = useOnboarding()
  const [showAll, setShowAll] = React.useState(false)
  const [bioTouched, setBioTouched] = React.useState(false)
  const [drafterOpen, setDrafterOpen] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const result = stepSchemas[2].safeParse(draft)
  const fieldErrors = result.success ? {} : result.error.flatten().fieldErrors
  const bioError = (showAll || bioTouched) && fieldErrors.bio ? fieldErrors.bio[0] : undefined

  const count = draft.bio.length

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const uploaded = await uploadProfessionalImage(file, userId, 'profile')
    setUploading(false)
    if (uploaded.ok) update({ profilePhotoUrl: uploaded.url })
    else setUploadError(uploaded.message)
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-md text-foreground">Put a face to the name</h1>
        <p className="text-muted text-sm">
          Customers choose people, not listings. This is the part that does the choosing.
        </p>
      </header>

      {/* ── Profile photo ── */}
      <div className="flex flex-col gap-1.5">
        <span className="text-foreground text-sm font-medium">Profile photo</span>
        <p className="text-muted text-xs">
          A clear photo of you or your logo. This is the first thing customers see.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          // `capture` opens the camera directly on a phone — the spec's
          // one-handed setup case, where "choose a file" is the wrong verb.
          capture="user"
          className="sr-only"
          onChange={(event) => {
            void onPhoto(event.target.files?.[0])
            event.target.value = ''
          }}
        />

        <div className="mt-2 flex items-center gap-4">
          {draft.profilePhotoUrl ? (
            <span className="relative">
              <Image
                src={draft.profilePhotoUrl}
                alt="Your profile photo"
                width={96}
                height={96}
                className="border-border size-24 rounded-full border object-cover"
              />
              <button
                type="button"
                onClick={() => update({ profilePhotoUrl: null })}
                aria-label="Remove profile photo"
                className="border-border bg-card text-muted hover:text-destructive absolute -top-1 -right-1 rounded-full border p-1"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          ) : (
            <Avatar
              src={null}
              alt={draft.businessName || 'Your storefront'}
              name={draft.businessName || '?'}
              size={96}
            />
          )}

          <Button
            variant="secondary"
            isLoading={uploading}
            loadingLabel="Uploading…"
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="size-4" aria-hidden="true" />
            {draft.profilePhotoUrl ? 'Change photo' : 'Add photo'}
          </Button>
        </div>

        {uploadError && (
          <p role="alert" className="text-destructive mt-1 text-xs">
            {uploadError}
          </p>
        )}
      </div>

      {/* ── Bio ── */}
      <div className="flex flex-col gap-1.5">
        <Textarea
          label="Tell customers about your work"
          hint="50–500 characters. What you do, who you help, why you’re good at it."
          rows={6}
          required
          value={draft.bio}
          maxLength={BIO_MAX}
          error={bioError}
          onBlur={() => setBioTouched(true)}
          onChange={(event) => update({ bio: event.target.value })}
        />
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" size="sm" onClick={() => setDrafterOpen(true)}>
            <Sparkles className="size-4" aria-hidden="true" />
            Draft my bio
          </Button>
          <span
            className={cn(
              'font-mono text-xs tabular-nums',
              count >= BIO_MAX
                ? 'text-destructive'
                : count >= BIO_MAX - 20
                  ? 'text-warning'
                  : 'text-muted'
            )}
          >
            {count}/{BIO_MAX}
          </span>
        </div>
        <p className="text-muted text-xs">
          We’ll write three options from a few keywords. First draft is free.
        </p>
        {count > 0 && count < BIO_MIN && !bioError && (
          <p className="text-muted text-xs">
            <span className="font-mono tabular-nums">{BIO_MIN - count}</span> more characters to go.
          </p>
        )}
      </div>

      <BioDrafter
        open={drafterOpen}
        onOpenChange={setDrafterOpen}
        onChoose={(bio) => update({ bio: bio.slice(0, BIO_MAX) })}
      />

      <StepActions
        forwardLabel="Continue"
        onForward={() => {
          if (!result.success) {
            setShowAll(true)
            setBioTouched(true)
            return
          }
          setStep(3)
        }}
      />
    </section>
  )
}
