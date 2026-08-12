'use client'

/**
 * Invoice acknowledge panel (playbook S093, deck §14.2/§14.4 — verbatim).
 * One idempotent action; the payment-instructions block renders below once
 * acknowledged (and always for an already-acknowledged return visit).
 */
import * as React from 'react'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-TT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function InvoiceActions({
  token,
  initialAcknowledgedAt,
}: {
  token: string
  initialAcknowledgedAt: string | null
}) {
  const [acknowledgedAt, setAcknowledgedAt] = React.useState(initialAcknowledgedAt)
  const [justNow, setJustNow] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const acknowledge = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/invoice/${token}/acknowledge`, { method: 'POST' })
      const json = (await res.json().catch(() => null)) as { acknowledged_at?: string } | null
      if (res.ok && json?.acknowledged_at) {
        setAcknowledgedAt(json.acknowledged_at)
        setJustNow(true)
      } else {
        setError("Couldn't record your response. Refresh and try again, or message us on WhatsApp.")
      }
    } catch {
      setError("Couldn't record your response. Refresh and try again, or message us on WhatsApp.")
    } finally {
      setBusy(false)
    }
  }

  if (acknowledgedAt) {
    return (
      <Banner
        kind="success"
        text={
          justNow
            ? 'Invoice acknowledged. Payment details are below.'
            : `You acknowledged this invoice on ${formatDate(acknowledgedAt)}.`
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div>
        <Button onClick={acknowledge} isLoading={busy} loadingLabel="Recording…">
          Acknowledge invoice
        </Button>
      </div>
    </div>
  )
}
