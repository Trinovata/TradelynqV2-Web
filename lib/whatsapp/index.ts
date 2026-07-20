/**
 * WhatsApp deep links (playbook S074, spec `components-patterns.md` §12).
 *
 * WhatsApp is the primary contact channel in Trinidad & Tobago, so every "chat"
 * affordance on the platform routes through here. Two rules the types enforce:
 *
 *  1. **No free-text messages.** A caller passes a `template` from a closed
 *     union and its data — never an arbitrary string. That makes the lexicon
 *     controllable at the type level: the copy decks write these messages, and a
 *     component cannot invent one. Free-text would also be an injection surface,
 *     since the message is interpolated into a URL.
 *
 *  2. **E.164 only, and only after the reveal gate.** The phone number is
 *     redacted server-side until a customer passes the connection gate; this
 *     module never sees a number before that, and a malformed one produces no
 *     link rather than a broken `wa.me` URL.
 *
 * NOT `server-only`: `WhatsAppButton` is a client component and builds the href
 * in the browser. Nothing here touches a secret — the number is a prop that was
 * already reveal-gated on the server — and URL construction is pure.
 */

/**
 * The closed set of contexts a WhatsApp message can be sent from. Each maps to a
 * deck-written template below. Adding a context is a deliberate edit here, not
 * something a call site can do inline.
 */
export type WhatsAppTemplate =
  'storefront_intro' | 'enquiry_followup' | 'quote_sent' | 'invoice_sent' | 'booking_confirm'

/**
 * The template strings, verbatim from the copy decks (`copy-public.md` §storefront).
 * `{placeholders}` are filled from `templateData` and URL-encoded as a unit.
 */
const TEMPLATES: Record<WhatsAppTemplate, string> = {
  storefront_intro:
    "Hi {name}, I found you on TradeLynq and I'd like to enquire about your services.",
  enquiry_followup: 'Hi {name}, following up on my enquiry ({ref}) from TradeLynq.',
  quote_sent: 'Hi {name}, I have sent you a quote ({ref}) via TradeLynq.',
  invoice_sent: 'Hi {name}, I have sent you an invoice ({ref}) via TradeLynq.',
  booking_confirm: 'Hi {name}, confirming our booking ({ref}) from TradeLynq.',
}

/**
 * The analytics context a WhatsApp click carries. Kept as a closed union so the
 * `whatsapp_clicked{context}` event cannot drift.
 */
export type WhatsAppClickContext =
  'storefront' | 'search_card' | 'enquiry_detail' | 'quote_detail' | 'invoice_detail'

/**
 * Normalises a T&T number to the digits `wa.me` expects (E.164 without the `+`),
 * or returns null. Shares the accept-or-refuse discipline of the OTP normaliser:
 * a number this cannot parse yields no link rather than a wrong one.
 */
export function whatsappDigits(phone: string): string | null {
  const digits = phone.replace(/[^\d]/g, '')
  if (digits.length === 11 && digits.startsWith('1868')) return digits
  if (digits.length === 10 && digits.startsWith('868')) return `1${digits}`
  return null
}

/**
 * Interpolates a template. An absent placeholder is left as the empty string
 * rather than a literal `{name}` leaking into a real person's chat.
 */
function renderTemplate(template: WhatsAppTemplate, data: Record<string, string>): string {
  return TEMPLATES[template].replace(/\{(\w+)\}/g, (_, key: string) => data[key] ?? '')
}

/**
 * Builds a `wa.me` link, or null when the number cannot be parsed. The message is
 * URL-encoded as a whole, so a template placeholder value cannot inject query
 * parameters.
 */
export function whatsappLink(
  phone: string,
  template: WhatsAppTemplate,
  data: Record<string, string> = {}
): string | null {
  const digits = whatsappDigits(phone)
  if (!digits) return null

  const message = renderTemplate(template, data)
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
