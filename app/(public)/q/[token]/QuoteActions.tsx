'use client'

/**
 * Quote respond panel (playbook S093, deck §14.1/§14.4 — strings verbatim).
 * Accept opens a confirm dialog whose consequence line names what happens
 * next; decline takes an optional reason. Both POST to the idempotent respond
 * route and settle into the recorded state — a double-tap gets the guard
 * toast, never an error.
 */
import * as React from 'react'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Input'
import { whatsappDigits } from '@/lib/whatsapp'

type Settled = { status: string; respondedAt: string }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-TT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function QuoteActions({
  token,
  professionalName,
  professionalWhatsapp,
  expired,
  expiredAt,
  initialResponse,
}: {
  token: string
  professionalName: string
  professionalWhatsapp: string | null
  expired: boolean
  expiredAt: string | null
  initialResponse: Settled | null
}) {
  const [settled, setSettled] = React.useState<Settled | null>(initialResponse)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [declineOpen, setDeclineOpen] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [justSettled, setJustSettled] = React.useState<'accepted' | 'declined' | null>(null)

  const digits = professionalWhatsapp ? whatsappDigits(professionalWhatsapp) : null
  const discussHref = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(`Hi ${professionalName}, about the quote you sent on TradeLynq…`)}`
    : undefined

  const respond = async (response: 'accepted' | 'declined') => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/quote/${token}/respond`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response, note: reason.trim() || undefined }),
      })
      const json = (await res.json().catch(() => null)) as {
        status?: string
        responded_at?: string
      } | null
      if (res.ok && json?.status && json.responded_at) {
        setSettled({ status: json.status, respondedAt: json.responded_at })
        setJustSettled(response)
        setConfirmOpen(false)
        setDeclineOpen(false)
      } else {
        setError("Couldn't record your response. Refresh and try again, or message us on WhatsApp.")
      }
    } catch {
      setError("Couldn't record your response. Refresh and try again, or message us on WhatsApp.")
    } finally {
      setBusy(false)
    }
  }

  // Settled states (§14.4): banners, actions hidden.
  if (settled) {
    const date = formatDate(settled.respondedAt)
    if (settled.status === 'accepted') {
      return (
        <Banner
          kind="success"
          text={
            justSettled === 'accepted'
              ? `Quote accepted. ${professionalName} will send your invoice shortly.`
              : `You accepted this quote on ${date}. ${professionalName} will send your invoice.`
          }
        />
      )
    }
    if (settled.status === 'declined') {
      return (
        <Banner
          kind="info"
          text={
            justSettled === 'declined'
              ? `Quote declined. You can still reach ${professionalName} on WhatsApp if things change.`
              : `You declined this quote on ${date}.`
          }
        />
      )
    }
    return <Banner kind="info" text={`This quote was ${settled.status} on ${date}.`} />
  }

  if (expired) {
    return (
      <Banner
        kind="warning"
        text={`This quote expired on ${expiredAt ? formatDate(expiredAt) : 'its validity date'}. Contact ${professionalName} for an updated one.`}
        action={discussHref ? { label: 'Discuss on WhatsApp', href: discussHref } : undefined}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setConfirmOpen(true)}>Accept quote</Button>
        <Button variant="secondary" onClick={() => setDeclineOpen(true)}>
          Decline
        </Button>
        {discussHref && (
          <Button asChild variant="ghost">
            <a href={discussHref}>Discuss on WhatsApp</a>
          </Button>
        )}
      </div>

      <Modal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Accept this quote?"
        description={`${professionalName} will be notified and will send you an invoice for this amount.`}
        footer={
          <Button onClick={() => respond('accepted')} isLoading={busy} loadingLabel="Recording…">
            Accept quote
          </Button>
        }
      >
        <p className="text-body text-sm">
          {professionalName} will be notified and will send you an invoice for this amount.
        </p>
      </Modal>

      <Modal
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        title="Decline quote"
        footer={
          <Button
            variant="secondary"
            onClick={() => respond('declined')}
            isLoading={busy}
            loadingLabel="Recording…"
          >
            Decline quote
          </Button>
        }
      >
        <Textarea
          label="Reason (optional)"
          placeholder="Let them know why (optional)"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Modal>
    </div>
  )
}
