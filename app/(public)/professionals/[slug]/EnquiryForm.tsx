'use client'

/**
 * The enquiry form (playbook S085 close-out under S083, spec v2/08 §8.2, copy
 * copy-public.md §5.11 — every string verbatim from the deck).
 *
 * A controlled Modal owned by StorefrontActions: describe the job, an optional
 * preferred date, how they should reply, send. The server owns every rule
 * (legal, the two-free-contacts gate, the 60s duplicate guard,
 * listing-is-active); this form relays the outcome and NEVER dead-ends:
 *
 *   LEGAL_ACCEPTANCE_REQUIRED → the shared LegalAcceptanceModal opens inline
 *     (via the parent) and acceptance retries THIS submit — not a link away.
 *   KYC_REQUIRED → the KycGateSheet opens (via the parent) — not a wrong route.
 *   201 → success state with `Chat on WhatsApp now`; the parent flips the rail
 *     to revealed, because the enquiry auto-created the connection
 *     (v2/08 §8.1: "one gate, not two").
 *
 * On success it becomes a confirmation rather than resetting, so a customer
 * never double-sends by reflex.
 */
import * as React from 'react'
import { CheckCircle2, ShieldAlert } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { whatsappLink } from '@/lib/whatsapp'
import { track } from '@/lib/analytics/events'
import { STOREFRONT_COPY } from '@/lib/copy/storefront'
import type { ContactInfo } from './StorefrontActions'

const COPY = STOREFRONT_COPY.enquiry

type Contact = 'whatsapp' | 'call' | 'email'
/** §5.11 labels; the API values stay `whatsapp | call | email`. */
const CONTACTS: { value: Contact; label: string }[] = [
  { value: 'whatsapp', label: COPY.contactOptions.whatsapp },
  { value: 'call', label: COPY.contactOptions.call },
  { value: 'email', label: COPY.contactOptions.email },
]

// D54: 20–1,000 characters.
const MIN = 20
const MAX = 1000

type Outcome =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; contact: ContactInfo | null }

export function EnquiryForm({
  open,
  onOpenChange,
  professionalId,
  firstName,
  onLegalRequired,
  onKycRequired,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  professionalId: string
  /** The deck addresses a person: `Request a quote from {first name}` (§5.11). */
  firstName: string
  /** Opens the shared LegalAcceptanceModal; acceptance runs the retry. */
  onLegalRequired: (missingDocuments: string[], retry: () => void) => void
  /** Opens the shared KycGateSheet. */
  onKycRequired: () => void
  /** 201 — the connection now exists; the parent flips the rail to revealed. */
  onSuccess: (contact: ContactInfo | null) => void
}) {
  const [description, setDescription] = React.useState('')
  const [preferredDate, setPreferredDate] = React.useState('')
  const [contact, setContact] = React.useState<Contact>('whatsapp')
  const [submitting, setSubmitting] = React.useState(false)
  const [attempted, setAttempted] = React.useState(false)
  const [outcome, setOutcome] = React.useState<Outcome>({ kind: 'idle' })

  const tooShort = description.trim().length < MIN
  const showFieldError = attempted && tooShort

  async function submit(): Promise<void> {
    setAttempted(true)
    if (tooShort) return

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
        const json = (await res.json().catch(() => null)) as {
          data?: { contact?: ContactInfo }
        } | null
        const revealedContact = json?.data?.contact ?? null
        setOutcome({ kind: 'done', contact: revealedContact })
        onSuccess(revealedContact)
        return
      }

      const json = (await res.json().catch(() => ({}))) as {
        code?: string
        details?: { missingDocuments?: string[] }
      }
      switch (json.code) {
        case 'LEGAL_ACCEPTANCE_REQUIRED':
          // Inline modal, action preserved — acceptance re-runs this submit.
          onLegalRequired(json.details?.missingDocuments ?? [], () => void submit())
          return
        case 'KYC_REQUIRED':
          onKycRequired()
          return
        case 'DUPLICATE':
          setOutcome({ kind: 'error', message: COPY.duplicate(firstName) })
          return
        case 'INVALID_INPUT':
          setOutcome({ kind: 'error', message: COPY.descriptionError(firstName) })
          return
        case 'RATE_LIMITED':
          setOutcome({ kind: 'error', message: STOREFRONT_COPY.errors.rateLimited })
          return
        default:
          setOutcome({ kind: 'error', message: STOREFRONT_COPY.errors.internal })
      }
    } catch {
      setOutcome({ kind: 'error', message: STOREFRONT_COPY.errors.internal })
    } finally {
      setSubmitting(false)
    }
  }

  const successWaHref =
    outcome.kind === 'done' && outcome.contact
      ? whatsappLink(outcome.contact.whatsapp ?? outcome.contact.phone ?? '', 'storefront_intro', {
          name: firstName,
        })
      : null

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={COPY.title(firstName)}>
      {outcome.kind === 'done' ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          {/* M13 checkPop is the specified motion for this moment; the catalogue
              carries no utility class for it yet, so the icon is static. */}
          <CheckCircle2 className="text-success size-9" aria-hidden="true" />
          <p className="text-foreground font-medium">{COPY.successHeading}</p>
          <p className="text-muted max-w-sm text-sm text-pretty">{COPY.successBody}</p>
          {successWaHref && (
            <Button asChild variant="secondary" className="mt-1">
              <a
                href={successWaHref}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  track('whatsapp_clicked', { context: 'enquiry', counterparty_id: professionalId })
                }
              >
                {COPY.successWhatsapp}
              </a>
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="enq-desc" className="text-body mb-1 block text-sm font-medium">
              {COPY.descriptionLabel}
            </label>
            <textarea
              id="enq-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX))}
              rows={5}
              placeholder={COPY.descriptionPlaceholder}
              aria-invalid={showFieldError || undefined}
              aria-describedby={showFieldError ? 'enq-desc-error' : undefined}
              className={cn(
                'border-border bg-background text-body focus-visible:outline-ring w-full rounded-[--radius-control] border px-3 py-2 text-sm focus-visible:outline-2',
                showFieldError && 'border-destructive'
              )}
            />
            {showFieldError && (
              <p id="enq-desc-error" className="text-destructive mt-1 text-xs">
                {COPY.descriptionError(firstName)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="enq-date" className="text-body mb-1 block text-sm font-medium">
                {COPY.dateLabel}
              </label>
              {/* Native date input; the deck's `Any date` placeholder cannot
                  render in one (browsers show a locale mask instead). */}
              <input
                id="enq-date"
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                placeholder={COPY.datePlaceholder}
                className="border-border bg-background text-body focus-visible:outline-ring w-full rounded-[--radius-control] border px-3 py-2 text-sm focus-visible:outline-2"
              />
            </div>
            <div>
              <span className="text-body mb-1 block text-sm font-medium">{COPY.contactLabel}</span>
              <div className="flex gap-1" role="group" aria-label={COPY.contactLabel}>
                {CONTACTS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setContact(c.value)}
                    aria-pressed={contact === c.value}
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

          {outcome.kind === 'error' && <FormNotice>{outcome.message}</FormNotice>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              {COPY.cancel}
            </Button>
            <Button
              onClick={() => void submit()}
              isLoading={submitting}
              loadingLabel={COPY.submitLoading}
            >
              {COPY.submit}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function FormNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-warning/30 bg-warning/5 text-body flex items-start gap-2 rounded-[--radius-control] border p-3 text-sm">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}
