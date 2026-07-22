'use client'

/**
 * The enquiry form (playbook S085, spec 05 §8.2) — where a customer reaches a
 * professional. A controlled Modal owned by StorefrontActions: describe the job,
 * an optional preferred date, how they'd like to be reached, send.
 *
 * The server owns every rule (legal, the two-free-contacts gate, the 60s
 * duplicate guard, listing-is-active); this form just relays the outcome
 * honestly — a KYC wall, an unaccepted-terms prompt, or a clean success — inline,
 * because the public pages carry no Toaster. On success it becomes a confirmation
 * rather than resetting, so a customer never double-sends by reflex.
 */
import * as React from 'react'
import Link from 'next/link'
import { CheckCircle2, ShieldAlert } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

type Contact = 'whatsapp' | 'call' | 'email'
const CONTACTS: { value: Contact; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
]

const MIN = 20
const MAX = 1000

type Outcome =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'kyc'; message: string }
  | { kind: 'legal'; message: string }
  | { kind: 'done' }

export function EnquiryForm({
  open,
  onOpenChange,
  professionalId,
  professionalName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  professionalId: string
  professionalName: string
}) {
  const [description, setDescription] = React.useState('')
  const [preferredDate, setPreferredDate] = React.useState('')
  const [contact, setContact] = React.useState<Contact>('whatsapp')
  const [submitting, setSubmitting] = React.useState(false)
  const [outcome, setOutcome] = React.useState<Outcome>({ kind: 'idle' })

  const tooShort = description.trim().length < MIN
  const remaining = MAX - description.length

  async function submit() {
    setSubmitting(true)
    setOutcome({ kind: 'idle' })
    try {
      const res = await fetch('/api/enquiries/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          professional_id: professionalId,
          description: description.trim(),
          contact_preference: contact,
          ...(preferredDate ? { preferred_date: preferredDate } : {}),
        }),
      })
      if (res.ok) {
        setOutcome({ kind: 'done' })
        return
      }
      const json = (await res.json().catch(() => ({}))) as { code?: string; error?: string }
      if (json.code === 'KYC_REQUIRED') {
        setOutcome({
          kind: 'kyc',
          message:
            'You’ve used your two free contacts. Verify your identity to keep reaching professionals.',
        })
      } else if (json.code === 'LEGAL_ACCEPTANCE_REQUIRED') {
        setOutcome({
          kind: 'legal',
          message: 'Please review and accept our latest policies before sending an enquiry.',
        })
      } else {
        setOutcome({ kind: 'error', message: json.error ?? 'That didn’t send. Try again in a moment.' })
      }
    } catch {
      setOutcome({ kind: 'error', message: 'Check your connection and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Enquire with ${professionalName}`}>
      {outcome.kind === 'done' ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="text-success size-9" aria-hidden="true" />
          <p className="text-foreground font-medium">Enquiry sent to {professionalName}</p>
          <p className="text-muted max-w-sm text-sm text-pretty">
            They’ll be notified and can reach you on your preferred channel. You’ll see their reply
            in your enquiries.
          </p>
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="mt-1">
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="enq-desc" className="text-body mb-1 block text-sm font-medium">
              What do you need done?
            </label>
            <textarea
              id="enq-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX))}
              rows={5}
              placeholder="Describe the job — what, where, and any detail that helps them quote."
              className="border-border bg-background text-body focus-visible:outline-ring w-full rounded-[--radius-control] border px-3 py-2 text-sm focus-visible:outline-2"
            />
            <p className={cn('mt-1 text-xs', tooShort ? 'text-muted' : 'text-muted')}>
              {tooShort ? `At least ${MIN} characters.` : `${remaining} left.`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="enq-date" className="text-body mb-1 block text-sm font-medium">
                Preferred date <span className="text-muted font-normal">(optional)</span>
              </label>
              <input
                id="enq-date"
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="border-border bg-background text-body focus-visible:outline-ring w-full rounded-[--radius-control] border px-3 py-2 text-sm focus-visible:outline-2"
              />
            </div>
            <div>
              <span className="text-body mb-1 block text-sm font-medium">Reach me by</span>
              <div className="flex gap-1">
                {CONTACTS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setContact(c.value)}
                    className={cn(
                      'flex-1 rounded-[--radius-control] border px-2 py-2 text-xs font-medium transition-colors',
                      contact === c.value
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-border text-muted hover:bg-card-subtle'
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {outcome.kind === 'kyc' && (
            <FormNotice tone="warn">
              {outcome.message}{' '}
              <Link href="/kyc" className="text-accent-ink underline underline-offset-2">
                Verify now
              </Link>
            </FormNotice>
          )}
          {outcome.kind === 'legal' && (
            <FormNotice tone="warn">
              {outcome.message}{' '}
              <Link href="/legal/terms" className="text-accent-ink underline underline-offset-2">
                Review policies
              </Link>
            </FormNotice>
          )}
          {outcome.kind === 'error' && <FormNotice tone="error">{outcome.message}</FormNotice>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={submitting} disabled={tooShort}>
              Send enquiry
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function FormNotice({ tone, children }: { tone: 'warn' | 'error'; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-[--radius-control] border p-3 text-sm',
        tone === 'error'
          ? 'border-destructive/30 bg-destructive/5 text-destructive'
          : 'border-warning/30 bg-warning/5 text-body'
      )}
    >
      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}
