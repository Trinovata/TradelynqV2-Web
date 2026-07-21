'use client'

/**
 * The enquiry action bar (spec 05 §5.2–5.3).
 *
 * State-dependent actions on a single enquiry: accept, decline (with the reason
 * panel), mark completed. The server owns the transition rules; this component
 * only offers the moves that are legal from the current state, then reflects the
 * result by refreshing the server-rendered detail so the status badge and the
 * available actions update together.
 *
 * Optimism is deliberately light: the request is one tap and usually instant, so
 * rather than paint a fake state we lock the buttons, show the outcome as a
 * toast (deck copy), and let `router.refresh()` bring the true new state.
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils/cn'
import type { Enums } from '@/types/database'

type Status = Enums<'enquiry_status'>
type Action = 'accept' | 'decline' | 'complete'

/** The canned decline reasons, verbatim from the deck (§5.3). */
const DECLINE_REASONS = [
  "I'm fully booked for those dates",
  'This is outside my service area',
  "This isn't something I offer",
  "The budget doesn't fit this job",
  "I can't take on new work right now",
  'I need more detail before I can help',
] as const

const OTHER = 'Something else'

export function EnquiryActions({
  enquiryId,
  status,
  firstName,
}: {
  enquiryId: string
  status: Status
  firstName: string
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState<Action | null>(null)
  const [declineOpen, setDeclineOpen] = React.useState(false)
  const [reason, setReason] = React.useState<string>('')
  const [otherText, setOtherText] = React.useState('')

  async function run(action: Action, declineReason?: string) {
    setPending(action)
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(declineReason ? { action, reason: declineReason } : { action }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast(json.error ?? 'That did not go through. Try again in a moment.', { kind: 'error' })
        return
      }
      if (action === 'accept') toast(`Enquiry accepted. ${firstName} has been notified.`, { kind: 'success' })
      else if (action === 'decline') toast(`Enquiry declined. ${firstName} has been notified.`, { kind: 'success' })
      else toast('Enquiry marked completed.', { kind: 'success' })
      setDeclineOpen(false)
      router.refresh()
    } catch {
      toast('Check your connection and try again.', { kind: 'error' })
    } finally {
      setPending(null)
    }
  }

  function submitDecline() {
    const resolved = reason === OTHER ? otherText.trim() : reason
    if (!resolved) {
      toast('Choose a reason for declining.', { kind: 'error' })
      return
    }
    void run('decline', resolved)
  }

  // Terminal states have no actions — the detail renders read-only.
  if (status === 'completed' || status === 'cancelled' || status === 'declined') return null

  if (declineOpen) {
    return (
      <div className="border-border bg-card rounded-[--radius-card] border p-4">
        <h2 className="text-foreground font-medium">Decline this enquiry?</h2>
        <p className="text-muted mt-1 text-sm">
          We&apos;ll let {firstName} know politely and suggest other professionals. Choose a reason —
          it helps us and stays private to you.
        </p>

        <fieldset className="mt-4 flex flex-col gap-1">
          {[...DECLINE_REASONS, OTHER].map((option) => {
            const selected = reason === option
            return (
              <label
                key={option}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-[--radius-control] border px-3 py-2.5 text-sm transition-colors',
                  selected ? 'border-accent bg-accent-soft' : 'border-border hover:bg-card-subtle'
                )}
              >
                <input
                  type="radio"
                  name="decline-reason"
                  value={option}
                  checked={selected}
                  onChange={() => setReason(option)}
                  className="accent-[--accent]"
                />
                <span className={cn(selected ? 'text-foreground' : 'text-body')}>{option}</span>
              </label>
            )
          })}
        </fieldset>

        {reason === OTHER && (
          <textarea
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Add a reason (optional)"
            className="border-border bg-background text-body focus-visible:outline-ring mt-2 w-full rounded-[--radius-control] border px-3 py-2 text-sm focus-visible:outline-2"
          />
        )}

        <div className="mt-4 flex gap-2">
          <Button
            variant="destructive"
            isLoading={pending === 'decline'}
            onClick={submitDecline}
          >
            Decline enquiry
          </Button>
          <Button variant="ghost" onClick={() => setDeclineOpen(false)} disabled={pending !== null}>
            Keep it
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'pending' && (
        <>
          <Button isLoading={pending === 'accept'} onClick={() => run('accept')}>
            Accept
          </Button>
          <Button variant="ghost" onClick={() => setDeclineOpen(true)} disabled={pending !== null}>
            Decline
          </Button>
        </>
      )}
      {(status === 'accepted' || status === 'in_progress') && (
        <Button isLoading={pending === 'complete'} onClick={() => run('complete')}>
          Mark completed
        </Button>
      )}
    </div>
  )
}
