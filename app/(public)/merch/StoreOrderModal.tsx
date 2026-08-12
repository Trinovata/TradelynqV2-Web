'use client'

/**
 * StoreOrderButton + modal (playbook S091, deck §12.2 — strings verbatim).
 * Fields render by product category (size/colour for apparel, print notes for
 * cards, date/location for photography — folded into notes for the API, whose
 * schema is the store_orders shape). Success replaces the form with the
 * reference + WhatsApp follow-up (M13 moment).
 */
import * as React from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatTTD } from '@/lib/utils/format'
import { whatsappDigits } from '@/lib/whatsapp'
import { SUPPORT_PHONE } from '@/lib/constants/contact'
import {
  CASH_ON_DELIVERY_LIMIT_TTD,
  PAYMENT_METHODS,
  orderFieldsFor,
  type MerchProduct,
  type PaymentMethodId,
} from '@/lib/constants/merch'

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; orderId: string }
  | { kind: 'error'; message: string }

export function StoreOrderButton({ product }: { product: MerchProduct }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant="secondary" fullWidth onClick={() => setOpen(true)}>
        Order
      </Button>
      {open && <StoreOrderModal product={product} open={open} onOpenChange={setOpen} />}
    </>
  )
}

function StoreOrderModal({
  product,
  open,
  onOpenChange,
}: {
  product: MerchProduct
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fields = orderFieldsFor(product.category)
  const [status, setStatus] = React.useState<Status>({ kind: 'idle' })
  const [quantity, setQuantity] = React.useState(1)
  const [size, setSize] = React.useState('')
  const [colour, setColour] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [date, setDate] = React.useState('')
  const [location, setLocation] = React.useState('')
  const [fullName, setFullName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [payment, setPayment] = React.useState<PaymentMethodId>('bank_transfer')
  const [qtyError, setQtyError] = React.useState<string | null>(null)

  const total = product.price * Math.max(1, quantity)
  const codAvailable = total < CASH_ON_DELIVERY_LIMIT_TTD

  const submit = async () => {
    if (!Number.isInteger(quantity) || quantity < 1) {
      setQtyError('Choose a quantity of at least 1.')
      return
    }
    setQtyError(null)
    setStatus({ kind: 'sending' })
    const mergedNotes = [
      fields.dateLocation && date ? `Preferred date: ${date}` : null,
      fields.dateLocation && location ? `Location: ${location}` : null,
      notes || null,
    ]
      .filter(Boolean)
      .join('\n')
    try {
      const res = await fetch('/api/store/order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          quantity,
          full_name: fullName,
          email,
          phone: phone || undefined,
          size: fields.size ? size || undefined : undefined,
          color_preference: fields.colour ? colour || undefined : undefined,
          notes: mergedNotes || undefined,
          payment_method: payment,
        }),
      })
      const json = (await res.json().catch(() => null)) as { orderId?: string } | null
      if (res.status === 201 && json?.orderId) {
        setStatus({ kind: 'done', orderId: json.orderId })
      } else {
        setStatus({
          kind: 'error',
          message: "Couldn't place that order. Try again, or message us on WhatsApp.",
        })
      }
    } catch {
      setStatus({
        kind: 'error',
        message: "Couldn't place that order. Try again, or message us on WhatsApp.",
      })
    }
  }

  const digits = whatsappDigits(SUPPORT_PHONE)

  if (status.kind === 'done') {
    const ref = status.orderId.slice(0, 8)
    const waHref = digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(`Hi — following up on merch order ${ref} (${product.name}).`)}`
      : undefined
    return (
      <Modal open={open} onOpenChange={onOpenChange} title="Order received">
        <p className="text-body text-sm">
          Your order reference is <span className="font-mono tabular-nums">{ref}</span>. We&rsquo;ll
          confirm details and payment on WhatsApp shortly.
        </p>
        {waHref && (
          <div className="mt-4">
            <Button asChild fullWidth>
              <a href={waHref}>Follow up on WhatsApp</a>
            </Button>
          </div>
        )}
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Order ${product.name}`}
      footer={
        <Button
          onClick={submit}
          isLoading={status.kind === 'sending'}
          loadingLabel="Placing order…"
        >
          Place order
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-body text-sm">
          {product.name} ·{' '}
          <span className="font-mono tabular-nums">{formatTTD(product.price)}</span>
          {quantity > 1 && (
            <>
              {' '}
              × <span className="font-mono tabular-nums">{quantity}</span> ={' '}
              <span className="text-foreground font-mono font-medium tabular-nums">
                {formatTTD(total)}
              </span>
            </>
          )}
        </p>

        <Input
          label="Quantity"
          type="number"
          min={1}
          max={20}
          value={String(quantity)}
          onChange={(event) => setQuantity(Number(event.target.value))}
          error={qtyError ?? undefined}
          className="font-mono tabular-nums"
        />

        {fields.size && (
          <Input
            label="Size"
            placeholder="M / L / XL"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
        )}
        {fields.colour && (
          <Input
            label="Colour"
            placeholder="Navy"
            value={colour}
            onChange={(e) => setColour(e.target.value)}
          />
        )}
        {fields.dateLocation && (
          <>
            <Input
              label="Preferred date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Input
              label="Location"
              placeholder="Woodbrook, Port of Spain"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </>
        )}
        {fields.notes && (
          <Textarea
            label={product.category === 'business-cards' ? 'What should we print?' : 'Notes'}
            placeholder={
              product.category === 'business-cards'
                ? 'Name, trade, phone, WhatsApp — exactly as they should appear.'
                : 'Anything we should know.'
            }
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}

        <Input
          label="Your name"
          placeholder="Maria Gonzalez"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
        />
        <Input
          label="WhatsApp number"
          placeholder="868 000 0000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <fieldset>
          <legend className="text-foreground text-sm font-medium">
            How would you like to pay?
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            {PAYMENT_METHODS.map((method) => {
              const disabled = method.id === 'cash_on_delivery' && !codAvailable
              return (
                <label
                  key={method.id}
                  className={`flex items-center gap-2 text-sm ${disabled ? 'text-muted' : 'text-body'}`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    checked={payment === method.id}
                    onChange={() => setPayment(method.id)}
                    disabled={disabled}
                  />
                  {method.label}
                </label>
              )
            })}
          </div>
          <p className="text-muted mt-2 text-xs">
            You&rsquo;ll be billed after we confirm your order. Cash on delivery is available for
            orders under TTD $500.
          </p>
        </fieldset>

        {status.kind === 'error' && <p className="text-destructive text-sm">{status.message}</p>}
      </div>
    </Modal>
  )
}
