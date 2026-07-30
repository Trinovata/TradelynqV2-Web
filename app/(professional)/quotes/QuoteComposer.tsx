'use client'

/**
 * Quote composer (playbook S109, spec 05 §5.4). Premium-UI directive: live
 * line-item editor with totals that recompute as you type (mirroring the
 * server's computeQuoteTotals so the preview never lies), add/remove lines,
 * mono tabular money, a clean two-step create-then-share. The server is still
 * the source of truth — this preview is convenience, the 201 carries the
 * authoritative total.
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Copy, MessageCircle } from 'lucide-react'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Banner } from '@/components/ui/Banner'
import { formatTTD } from '@/lib/utils/format'
import { computeQuoteTotals } from '@/lib/quotes'

type Line = { description: string; quantity: string; unitPrice: string }

const emptyLine = (): Line => ({ description: '', quantity: '1', unitPrice: '' })

export function QuoteComposerButton() {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)} iconLeft={<Plus className="size-4" />}>
        New quote
      </Button>
      {open && <QuoteComposer open={open} onOpenChange={setOpen} />}
    </>
  )
}

function QuoteComposer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [customerName, setCustomerName] = React.useState('')
  const [customerPhone, setCustomerPhone] = React.useState('')
  const [lines, setLines] = React.useState<Line[]>([emptyLine()])
  const [vatPercent, setVatPercent] = React.useState('0')
  const [validUntil, setValidUntil] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState<{ link: string } | null>(null)

  // Live preview through the SAME maths the server uses — the numbers a
  // professional sees while typing are the numbers that get saved.
  const preview = computeQuoteTotals(
    lines.map((l) => ({
      description: l.description || '—',
      quantity: Math.max(1, Number(l.quantity) || 0),
      unit_price: Math.max(0, Math.round(Number(l.unitPrice) || 0)),
    })),
    Math.max(0, Number(vatPercent) || 0)
  )

  const setLine = (index: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  const addLine = () => setLines((prev) => [...prev, emptyLine()])
  const removeLine = (index: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))

  const create = async () => {
    if (!customerName.trim()) {
      setError('Add the customer’s name.')
      return
    }
    const validLines = lines.filter((l) => l.description.trim() && Number(l.unitPrice) >= 0)
    if (validLines.length === 0) {
      setError('Add at least one line with a description and price.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const createRes = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || undefined,
          line_items: validLines.map((l) => ({
            description: l.description.trim(),
            quantity: Math.max(1, Math.round(Number(l.quantity) || 1)),
            unit_price: Math.max(0, Math.round(Number(l.unitPrice) || 0)),
          })),
          vat_percent: Math.max(0, Number(vatPercent) || 0),
          valid_until: validUntil || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      const createJson = (await createRes.json().catch(() => null)) as {
        quote?: { id: string }
      } | null
      if (!createRes.ok || !createJson?.quote?.id) {
        setError('Couldn’t create the quote. Check the fields and try again.')
        return
      }
      // Two-step: create draft, then send to mint the customer link.
      const sendRes = await fetch(`/api/quotes/${createJson.quote.id}/send`, { method: 'POST' })
      const sendJson = (await sendRes.json().catch(() => null)) as {
        quote?: { customer_link: string }
      } | null
      if (sendRes.ok && sendJson?.quote?.customer_link) {
        setSent({ link: sendJson.quote.customer_link })
        router.refresh()
      } else {
        setError('Quote saved as a draft, but sending failed. Open it from the list to retry.')
        router.refresh()
      }
    } catch {
      setError('Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    const waHref = customerPhone.trim()
      ? `https://wa.me/${customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
          `Hi ${customerName}, here's your quote: ${sent.link}`
        )}`
      : undefined
    return (
      <Modal open={open} onOpenChange={onOpenChange} title="Quote sent">
        <div className="flex flex-col gap-4">
          <Banner kind="success" text="Your quote is ready to share." />
          <div className="border-border bg-card-subtle flex items-center gap-2 rounded-[--radius-control] border p-2">
            <span className="text-body flex-1 truncate font-mono text-xs">{sent.link}</span>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Copy className="size-4" />}
              onClick={() => navigator.clipboard?.writeText(sent.link)}
            >
              Copy
            </Button>
          </div>
          {waHref && (
            <Button asChild iconLeft={<MessageCircle className="size-4" />}>
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                Share on WhatsApp
              </a>
            </Button>
          )}
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New quote"
      size="lg"
      footer={
        <Button onClick={create} isLoading={busy} loadingLabel="Sending…">
          Create &amp; send
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Customer name"
            placeholder="Dev Maharaj"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <Input
            label="WhatsApp number"
            placeholder="868 000 0000"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
        </div>

        <div>
          <span className="text-foreground text-sm font-medium">Line items</span>
          <div className="mt-2 flex flex-col gap-2">
            {lines.map((line, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="flex-1">
                  <Input
                    aria-label={`Line ${index + 1} description`}
                    placeholder="3-zone AC service"
                    value={line.description}
                    onChange={(e) => setLine(index, { description: e.target.value })}
                  />
                </div>
                <div className="w-16">
                  <Input
                    aria-label={`Line ${index + 1} quantity`}
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => setLine(index, { quantity: e.target.value })}
                    className="font-mono tabular-nums"
                  />
                </div>
                <div className="w-24">
                  <Input
                    aria-label={`Line ${index + 1} unit price TTD`}
                    type="number"
                    min={0}
                    placeholder="250"
                    value={line.unitPrice}
                    onChange={(e) => setLine(index, { unitPrice: e.target.value })}
                    className="font-mono tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  disabled={lines.length === 1}
                  aria-label={`Remove line ${index + 1}`}
                  className="text-muted hover:text-destructive mt-2.5 disabled:opacity-30"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addLine}
            className="text-accent-ink mt-2 inline-flex items-center gap-1 text-sm"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add line
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="VAT %"
            type="number"
            min={0}
            max={100}
            value={vatPercent}
            onChange={(e) => setVatPercent(e.target.value)}
            className="font-mono tabular-nums"
          />
          <Input
            label="Valid until"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>

        <Textarea
          label="Notes (optional)"
          placeholder="Price includes gas top-up if needed."
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* Live totals — the same maths the server recomputes on submit. */}
        <div className="border-border flex flex-col gap-1 border-t pt-3 text-sm">
          <div className="text-body flex justify-between">
            <span>Subtotal</span>
            <span className="font-mono tabular-nums">{formatTTD(preview.subtotalTtd)}</span>
          </div>
          {preview.vatAmountTtd > 0 && (
            <div className="text-body flex justify-between">
              <span>VAT ({preview.vatPercent}%)</span>
              <span className="font-mono tabular-nums">{formatTTD(preview.vatAmountTtd)}</span>
            </div>
          )}
          <div className="text-foreground flex justify-between font-medium">
            <span>Total</span>
            <span className="font-mono text-base tabular-nums">{formatTTD(preview.totalTtd)}</span>
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
    </Modal>
  )
}
