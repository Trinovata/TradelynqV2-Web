'use client'

/**
 * Review form (playbook S099, spec 04 §4.2). StarRating input + testimonial
 * (20–600, the D54 bounds), server-forced pending status. Success is an M13
 * moment with the moderation-expectation copy — never implies the review is
 * live. Photo upload is deferred with the storage flow (S102/S113) and
 * flagged; the deck lists it optional.
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { StarRating } from '@/components/ui/StarRating'
import { Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

export function ReviewForm({
  enquiryId,
  professionalName,
}: {
  enquiryId: string
  professionalName: string
}) {
  const router = useRouter()
  const [rating, setRating] = React.useState<1 | 2 | 3 | 4 | 5 | 0>(0)
  const [testimonial, setTestimonial] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldError, setFieldError] = React.useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (rating === 0) {
      setError('Choose a star rating.')
      return
    }
    if (testimonial.trim().length < 20) {
      setFieldError('Tell us a little more — at least 20 characters.')
      return
    }
    setError(null)
    setFieldError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enquiry_id: enquiryId,
          star_rating: rating,
          testimonial: testimonial.trim(),
        }),
      })
      if (res.ok) {
        setDone(true)
      } else if (res.status === 409) {
        setError('This job has already been reviewed.')
      } else {
        setError('That didn’t send. Try again in a moment.')
      }
    } catch {
      setError('Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Banner
          kind="success"
          text="Thanks for your review. Reviews are published after a quick check by our team."
        />
        <div>
          <Button variant="secondary" onClick={() => router.push(`/home/enquiries/${enquiryId}`)}>
            Back to enquiry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div>
        <label className="text-foreground text-sm font-medium">
          How was your experience with {professionalName}?
        </label>
        <div className="mt-2">
          <StarRating
            value={rating}
            interactive
            label={`Your rating for ${professionalName}`}
            onChange={(value) => {
              setRating(value)
              setError(null)
            }}
          />
        </div>
      </div>

      <Textarea
        label="Your review"
        placeholder="What was the work, and how did it go?"
        rows={5}
        value={testimonial}
        onChange={(event) => setTestimonial(event.target.value)}
        error={fieldError ?? undefined}
        maxLength={600}
        required
      />

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div>
        <Button type="submit" isLoading={busy} loadingLabel="Sending…">
          Submit review
        </Button>
      </div>
    </form>
  )
}
