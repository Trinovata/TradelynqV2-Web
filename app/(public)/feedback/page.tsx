import type { Metadata } from 'next'
import { FeedbackForm } from './FeedbackForm'

/** Feedback (playbook S089, copy deck §11.5 — strings verbatim). */
export const metadata: Metadata = {
  title: 'Send feedback | TradeLynq',
}

export default function FeedbackPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-foreground font-display text-3xl tracking-tight">
        Tell us what you think
      </h1>
      <p className="text-body mt-1 text-sm">
        Bugs, ideas, or anything else — we read every message.
      </p>
      <div className="mt-8">
        <FeedbackForm />
      </div>
    </div>
  )
}
