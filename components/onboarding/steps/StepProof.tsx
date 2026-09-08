'use client'

/**
 * Step 4 — Proof (spec `v2/05 §5.2`, copy `copy-professional.md §4.4`).
 *
 * Optional and skippable by design. It is the step that most improves a
 * storefront and the step most likely to make someone abandon at 11pm with a
 * phone full of photos they cannot find — so `Skip for now` is a first-class
 * control, not a grey afterthought.
 *
 * ## The seeded reviews are a promise, not a shortcut
 *
 * A professional enters real customers from before the platform. Nothing they
 * type here appears anywhere until an admin phones that customer and confirms
 * it (`is_seeded`, `api-admin-cron.md §2.1`). The honesty note says exactly
 * that, verbatim from the deck, because the alternative — a page of
 * self-written five-star reviews — is the failure mode that kills a review
 * system's credibility permanently.
 */
import * as React from 'react'
import Image from 'next/image'
import { ImagePlus, Trash2, X } from 'lucide-react'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { StarRating } from '@/components/ui/StarRating'
import { useOnboarding } from '../context'
import { StepActions } from '../OnboardingWizard'
import { uploadProfessionalImage, ACCEPTED_IMAGE_TYPES } from '../upload'
import { PORTFOLIO_LIMIT, type OnboardingSeedReview } from '@/lib/professional/onboarding'

type PendingUpload = { id: string; name: string; error: string | null }

export function StepProof() {
  const { draft, update, setStep, userId } = useOnboarding()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [pending, setPending] = React.useState<PendingUpload[]>([])

  const remaining = PORTFOLIO_LIMIT - draft.portfolioUrls.length

  async function onFiles(files: FileList | null) {
    if (!files) return
    // Accumulated locally rather than read back from `draft` on each pass:
    // `draft` is captured at render, so appending to it inside a loop of awaits
    // would write `[original, photo3]` every time and every photo but the last
    // would vanish.
    let urls = draft.portfolioUrls

    // Each file uploads on its own and reports its own failure — the spec's
    // "every upload independently retryable". One bad photo in a batch of six
    // must not discard the other five.
    for (const file of Array.from(files).slice(0, Math.max(0, remaining))) {
      const id = `${file.name}-${crypto.randomUUID()}`
      setPending((queue) => [...queue, { id, name: file.name, error: null }])

      const result = await uploadProfessionalImage(file, userId, 'portfolio')
      if (result.ok) {
        urls = [...urls, result.url]
        update({ portfolioUrls: urls })
        setPending((queue) => queue.filter((item) => item.id !== id))
      } else {
        setPending((queue) =>
          queue.map((item) => (item.id === id ? { ...item, error: result.message } : item))
        )
      }
    }
  }

  function setReview(index: number, patch: Partial<OnboardingSeedReview>) {
    update({
      seedReviews: draft.seedReviews.map((review, position) =>
        position === index ? { ...review, ...patch } : review
      ),
    })
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-md text-foreground">Show what you’ve done</h1>
        <p className="text-muted text-sm">
          Optional — but storefronts with photos and reviews get far more enquiries.
        </p>
      </header>

      {/* ── Portfolio ── */}
      <div className="flex flex-col gap-2">
        <span className="text-foreground text-sm font-medium">Show your work</span>
        <p className="text-muted text-xs">
          Add up to <span className="font-mono tabular-nums">{PORTFOLIO_LIMIT}</span> photos of
          finished jobs. You can reorder these later.
        </p>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="sr-only"
          onChange={(event) => {
            void onFiles(event.target.files)
            event.target.value = ''
          }}
        />

        {draft.portfolioUrls.length > 0 && (
          <ul className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {draft.portfolioUrls.map((url) => (
              <li key={url} className="group relative aspect-square">
                <Image
                  src={url}
                  alt="Portfolio photo"
                  fill
                  sizes="(min-width: 640px) 140px, 30vw"
                  className="border-border rounded-[--radius-control] border object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    update({ portfolioUrls: draft.portfolioUrls.filter((item) => item !== url) })
                  }
                  aria-label="Remove photo"
                  className="border-border bg-card text-muted hover:text-destructive absolute -top-1.5 -right-1.5 rounded-full border p-1"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {pending.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1.5">
            {pending.map((item) => (
              <li key={item.id} className="text-muted flex items-center gap-2 text-xs">
                {item.error ? (
                  <>
                    <span className="text-destructive">{item.name} didn’t upload — retry</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPending((queue) => queue.filter((queued) => queued.id !== item.id))
                        fileRef.current?.click()
                      }}
                      className="text-accent-ink underline-offset-4 hover:underline"
                    >
                      Retry
                    </button>
                  </>
                ) : (
                  <span>Uploading {item.name}…</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="secondary"
          className="mt-2 self-start"
          disabled={remaining <= 0}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="size-4" aria-hidden="true" />
          {remaining <= 0 ? 'Photo limit reached' : 'Add photos'}
        </Button>
      </div>

      {/* ── Seeded reviews ── */}
      <div className="border-border flex flex-col gap-3 border-t pt-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-foreground font-medium">Add reviews from past customers</h2>
          <p className="text-muted text-xs">
            Worked with someone before TradeLynq? Add them here and we’ll invite them to confirm
            their review.
          </p>
        </div>

        <p className="border-border bg-card-subtle text-body rounded-[--radius-control] border p-3 text-xs">
          We verify these with your customers before publishing. Only confirmed reviews appear on
          your page.
        </p>

        {draft.seedReviews.map((review, index) => (
          <div
            key={index}
            className="border-border bg-card flex flex-col gap-3 rounded-[--radius-control] border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-muted text-xs">
                Review <span className="font-mono tabular-nums">{index + 1}</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  update({
                    seedReviews: draft.seedReviews.filter((_, position) => position !== index),
                  })
                }
                aria-label={`Remove review ${index + 1}`}
                className="text-muted hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Customer name"
                value={review.customer_name}
                maxLength={80}
                onChange={(event) => setReview(index, { customer_name: event.target.value })}
              />
              <Input
                label="WhatsApp or phone"
                type="tel"
                inputMode="tel"
                placeholder="868 000 0000"
                value={review.phone}
                maxLength={40}
                onChange={(event) => setReview(index, { phone: event.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-foreground text-sm font-medium">Rating</span>
              <StarRating
                value={review.rating}
                interactive
                label={`Rating for review ${index + 1}`}
                onChange={(rating) => setReview(index, { rating })}
              />
            </div>

            <Textarea
              label="What they’d say"
              rows={3}
              value={review.text}
              maxLength={300}
              onChange={(event) => setReview(index, { text: event.target.value })}
            />
          </div>
        ))}

        {draft.seedReviews.length < 10 && (
          <Button
            variant="secondary"
            className="self-start"
            onClick={() =>
              update({
                seedReviews: [
                  ...draft.seedReviews,
                  { customer_name: '', phone: '', rating: 5, text: '' },
                ],
              })
            }
          >
            Add a review
          </Button>
        )}
      </div>

      <StepActions
        forwardLabel="Continue"
        onForward={() => setStep(5)}
        onSkip={() => setStep(5)}
        skipLabel="Skip for now"
      />
    </section>
  )
}
