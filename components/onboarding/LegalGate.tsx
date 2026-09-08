'use client'

/**
 * The onboarding legal gate (playbook S107, copy `copy-professional.md §4.0`).
 *
 * Fires on mount when any of the three professional documents is outstanding at
 * its in-force version. Non-dismissable, unlike the customer's contact gate: a
 * customer who backs out of accepting simply does not contact anyone, whereas a
 * professional who backs out here would spend ten minutes building a storefront
 * that cannot be submitted. Better to ask before the work than after it.
 *
 * This is UX, not the boundary. `POST .../publish` re-checks acceptance through
 * `ensureLegalAcceptances`, so dismissing this by any means gets a 403 with the
 * missing list rather than a published storefront.
 */
import * as React from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'

export function LegalGate({ missingDocuments }: { missingDocuments: string[] }) {
  const [open, setOpen] = React.useState(missingDocuments.length > 0)
  const [accepted, setAccepted] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (missingDocuments.length === 0) return null

  async function accept() {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/legal/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Exactly what the server said was outstanding — the client does not
        // get to decide which documents count.
        body: JSON.stringify({ documents: missingDocuments }),
      })
      if (!response.ok) {
        setError('Please accept the terms to continue.')
        return
      }
      setOpen(false)
    } catch {
      setError('That didn’t go through. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={() => {
        /* Held open deliberately — see the note above. */
      }}
      dismissable={false}
      title="Before you start"
      description="To set up a storefront you'll need to accept our Terms of Service, Professional Agreement and Privacy Policy."
      footer={
        <Button onClick={accept} disabled={!accepted} isLoading={submitting}>
          Agree and continue
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-body text-sm">
          To set up a storefront you’ll need to accept our{' '}
          <Link
            href="/legal/terms"
            target="_blank"
            className="text-accent-ink underline underline-offset-4"
          >
            Terms of Service
          </Link>
          ,{' '}
          <Link
            href="/legal/eula"
            target="_blank"
            className="text-accent-ink underline underline-offset-4"
          >
            Professional Agreement
          </Link>{' '}
          and{' '}
          <Link
            href="/legal/privacy"
            target="_blank"
            className="text-accent-ink underline underline-offset-4"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <Checkbox
          checked={accepted}
          onCheckedChange={(value) => setAccepted(value === true)}
          label="I’ve read and accept the Terms, Professional Agreement and Privacy Policy."
        />

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
