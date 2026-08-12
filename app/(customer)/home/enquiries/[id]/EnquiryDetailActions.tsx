'use client'

/**
 * Customer enquiry-detail action zone (playbook S098, spec 04 §4.2 §5):
 * pending → cancel (ConfirmDialog); accepted/in-progress → WhatsApp with
 * context; completed → leave a review (or the honest status of one already
 * left). Quote accept/decline lands when professionals can SEND quotes to
 * customers (S109) — flagged, not faked.
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Banner } from '@/components/ui/Banner'
import { whatsappDigits } from '@/lib/whatsapp'

type Props = {
  enquiryId: string
  status: string
  professionalName: string
  professionalWhatsapp: string | null
  hasReview: boolean
}

export function EnquiryDetailActions({
  enquiryId,
  status,
  professionalName,
  professionalWhatsapp,
  hasReview,
}: Props) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const cancel = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}/cancel`, { method: 'POST' })
      if (res.ok) {
        setConfirmOpen(false)
        router.refresh()
      } else if (res.status === 409) {
        setError('This enquiry can no longer be cancelled — the professional may have responded.')
      } else {
        setError('That didn’t work. Try again in a moment.')
      }
    } catch {
      setError('Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (status === 'pending') {
    return (
      <div className="flex flex-col gap-3">
        {error && <Banner kind="warning" text={error} />}
        <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
          Cancel request
        </Button>
        <Modal
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Cancel this request?"
          footer={
            <Button
              variant="secondary"
              onClick={cancel}
              isLoading={busy}
              loadingLabel="Cancelling…"
            >
              Cancel request
            </Button>
          }
        >
          <p className="text-body text-sm">
            {professionalName} will no longer see this enquiry. You can always send a new one.
          </p>
        </Modal>
      </div>
    )
  }

  if (status === 'accepted' || status === 'in_progress') {
    const digits = professionalWhatsapp ? whatsappDigits(professionalWhatsapp) : null
    const href = digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(`Hi ${professionalName}, about my enquiry on TradeLynq…`)}`
      : undefined
    if (!href) return null
    return (
      <Button asChild>
        <a href={href}>Chat with {professionalName}</a>
      </Button>
    )
  }

  if (status === 'completed') {
    if (hasReview) {
      return (
        <Banner
          kind="success"
          text="Thanks — your review is in. It appears once our team has checked it."
        />
      )
    }
    return (
      <Button onClick={() => router.push(`/home/enquiries/${enquiryId}/review`)}>
        Leave a review
      </Button>
    )
  }

  return null
}
