'use client'

/**
 * LegalAcceptanceModal (playbook S057, flows `v2/08 §8.1`, copy `copy-public.md` §5).
 *
 * The inline gate that fires when a gated action (contacting a professional)
 * needs legal documents the customer has not accepted at the in-force version.
 * It is deliberately NOT a dead end: it never navigates away, and on acceptance
 * it resolves the action the user was already trying to take.
 *
 * Security posture: this component is UX, not the boundary. The API re-checks
 * acceptance on every gated call (`ensureLegalAcceptances`), so a user who
 * dismisses or bypasses this modal simply gets a 403 with the missing list — the
 * gate holds server-side regardless of what the client renders.
 *
 * Copy is verbatim from the deck. `dismissable` is left ON: unlike a destructive
 * confirm, a customer who is not ready to accept must be able to back out, and
 * the pending action is preserved so they can resume.
 */
import * as React from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'

/** Deck strings — never invent copy a deck already wrote. */
const COPY = {
  heading: 'One quick step',
  body: 'To contact professionals, please accept our Terms of Service and Privacy Policy.',
  primary: 'Accept & continue',
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  error: "That didn't go through. Please try again.",
} as const

export type LegalAcceptanceModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The documents still outstanding, from `GET /api/legal/status`. */
  missingDocuments: string[]
  /**
   * Run after acceptance succeeds. This is the action the user was taking when
   * the gate fired — sending the enquiry, revealing contact — so acceptance
   * resumes it rather than dropping them back at square one.
   */
  onAccepted: () => void
}

export function LegalAcceptanceModal({
  open,
  onOpenChange,
  missingDocuments,
  onAccepted,
}: LegalAcceptanceModalProps) {
  const [submitting, setSubmitting] = React.useState(false)

  async function accept() {
    setSubmitting(true)
    try {
      const response = await fetch('/api/legal/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Accept exactly what is outstanding. The server records each at its
        // in-force version and ignores anything not in the known set.
        body: JSON.stringify({ documents: missingDocuments }),
      })

      if (!response.ok) {
        // Retry in place — the spec's failure path is "modal retry, action
        // preserved", never a dead end.
        toast(COPY.error, { kind: 'error' })
        return
      }

      onOpenChange(false)
      onAccepted()
    } catch {
      toast(COPY.error, { kind: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={COPY.heading}
      description={COPY.body}
      footer={
        <Button onClick={accept} isLoading={submitting} loadingLabel="Recording your acceptance…">
          {COPY.primary}
        </Button>
      }
    >
      <p className="text-body text-sm">
        By continuing you agree to our{' '}
        <a
          href="/legal/terms"
          target="_blank"
          rel="noreferrer"
          className="text-accent-ink underline"
        >
          {COPY.terms}
        </a>{' '}
        and{' '}
        <a
          href="/legal/privacy"
          target="_blank"
          rel="noreferrer"
          className="text-accent-ink underline"
        >
          {COPY.privacy}
        </a>
        .
      </p>
    </Modal>
  )
}
