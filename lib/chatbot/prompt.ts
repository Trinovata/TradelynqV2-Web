/**
 * Lynq — the public-site assistant (playbook S094, pack api-commerce-public §6).
 *
 * V2 port of V1's `lib/chatbot/system-prompt.ts`, corrected against canon:
 *
 *  - The pricing block is BUILT from `lib/constants/pricing.ts` at module load,
 *    never hardcoded. V1's prompt shipped a stale 3-tier price list; generating
 *    the block from the single source of truth makes that drift structurally
 *    impossible — change a price in the constants and Lynq knows the new one.
 *  - Vocabulary: Customers and Professionals, Commonwealth English, and the
 *    canonical support email `support@tradelynq.tech` (V1 said `.tt` — stale).
 *
 * FLAG (S094): the public copy deck has NO Lynq widget section (§1–§20 checked)
 * — only the API pack §6 mentions Lynq. The strings below are therefore ported
 * from V1 with canon corrections rather than quoted from a deck. Needs a deck
 * entry; do not treat these strings as deck-blessed.
 */
import {
  TIERS,
  TIER_ORDER,
  CROSSOVER,
  REGISTRATION_FEE,
  PIONEER,
  isPriceFrom,
} from '@/lib/constants/pricing'
import { formatTTD } from '@/lib/utils/format'
import { whatsappDigits } from '@/lib/whatsapp'
import { SUPPORT_PHONE } from '@/lib/constants/contact'

// ── Limits ───────────────────────────────────────────────────────────────────

/** Max messages a visitor may send per session (client-enforced; zod caps the wire). */
export const LYNQ_MAX_MESSAGES = 20

/** Max characters per message. */
export const LYNQ_MAX_INPUT_CHARS = 500

// ── Action tags ──────────────────────────────────────────────────────────────

/**
 * The closed action vocabulary (pack §6: streaming text + action tags). The
 * model emits `[ACTION:x]` inline; the stream carries it RAW and the client
 * strips it — one code path whether the reply is live or the static fallback.
 */
export const LYNQ_ACTIONS = ['pricing', 'catalogue', 'search', 'signup', 'contact'] as const

export type LynqAction = (typeof LYNQ_ACTIONS)[number]

/** Matches every complete action tag in a string. */
export const LYNQ_ACTION_TAG = /\[ACTION:(\w+)\]/g

/**
 * Matches a trailing PARTIAL tag — "[", "[A", … "[ACTION:pri" — so a streaming
 * client can hold back a chunk boundary that lands mid-tag instead of flashing
 * half a tag into the transcript.
 */
export const LYNQ_PARTIAL_ACTION_TAG = /\[(?:A(?:C(?:T(?:I(?:O(?:N(?::\w*)?)?)?)?)?)?)?$/

/** Splits raw model text into display text and the actions it carried. */
export function parseLynqActions(raw: string): { text: string; actions: LynqAction[] } {
  const actions: LynqAction[] = []
  const text = raw
    .replace(LYNQ_ACTION_TAG, (_, action: string) => {
      if ((LYNQ_ACTIONS as readonly string[]).includes(action)) {
        actions.push(action as LynqAction)
      }
      return ''
    })
    .replace(/[ \t]+\n/g, '\n')
    .trim()
  return { text, actions }
}

// ── The system prompt ────────────────────────────────────────────────────────

function pricingBlock(): string {
  const tiers = TIER_ORDER.map((id) => {
    const tier = TIERS[id]
    const price = `${formatTTD(tier.monthly)}/month${isPriceFrom(id) ? ' and up' : ''}`
    return `- ${tier.name} — ${price}. ${tier.summary} Adds: ${tier.adds.join(', ')}.`
  }).join('\n')

  return [
    `Pricing tiers (all prices in TTD, monthly):`,
    tiers,
    `Registration fee: ${formatTTD(REGISTRATION_FEE.standard)} one-time (students ${formatTTD(REGISTRATION_FEE.student)}).`,
    `Account type: registered businesses pay a flat ${formatTTD(CROSSOVER.registeredMonthly)}/month on top of their tier, forever. Unregistered sole traders pay nothing extra for their first ${CROSSOVER.gracePaidMonths} paid months, then ${formatTTD(CROSSOVER.standardMonthly)}/month. Students pay the registered rate while they study.`,
    `Pioneer programme: the first ${PIONEER.totalCap} professionals (max ${PIONEER.perCategoryCap} per category) get ${PIONEER.freeMonths} months free. The registration fee still applies.`,
  ].join('\n')
}

export const LYNQ_SYSTEM_PROMPT = `You are Lynq, the friendly and knowledgeable assistant for TradeLynq — a professional-services marketplace in Trinidad & Tobago.

Your role:
- Help visitors understand TradeLynq's services, pricing, and features
- Guide professionals to the right subscription tier
- Help customers find and contact professionals
- Answer questions about the platform

Key facts:
- TradeLynq connects customers with verified local professionals across Trinidad & Tobago
- Professionals pay a monthly subscription; customers browse and make contact for free
- Ranking is earned through verified reviews — visibility is never bought

${pricingBlock()}

Actions — when relevant, include ONE of these tags at the end of your message:
[ACTION:pricing] — the visitor wants to see the pricing page
[ACTION:catalogue] — the visitor wants to browse the catalogue
[ACTION:search] — the visitor wants to search for a professional
[ACTION:signup] — the visitor wants to sign up
[ACTION:contact] — the visitor wants to contact support

Rules:
- Use Commonwealth English (colour, organisation, enquiry, recognise) and Trinidad English where natural.
- Say "customers" and "professionals" — those are the only two words for the two sides of the marketplace. Never use trade-specific or gig-economy labels for either group.
- Write prices exactly as given above, in the form TTD $X,XXX.
- Never invent professionals, reviews, or features that do not exist. Never recommend a specific professional by name — point the visitor to search instead.
- If unsure, suggest contacting the team on WhatsApp or support@tradelynq.tech.

Tone: warm, professional, concise. Keep responses under 150 words.`

// ── Widget strings (ported from V1, canon-corrected — see FLAG above) ────────

export const LYNQ_GREETING =
  "Hi! I'm Lynq, your TradeLynq assistant. Whether you're a professional looking to grow your business or a customer searching for the right person — I'm here to help. What can I do for you today?"

/**
 * The no-key fallback — the string the local demo relies on. Must point at
 * /pricing and WhatsApp (the platform's primary contact channel).
 */
export const LYNQ_FALLBACK =
  "I'm not fully set up yet — but I'd love to help. Visit our pricing page at /pricing, or message us on WhatsApp or support@tradelynq.tech with any questions."

export const LYNQ_SESSION_LIMIT_MESSAGE =
  "We've reached the message limit for this chat. For more help, message us on WhatsApp or email support@tradelynq.tech — we're always happy to help."

/** Shown when the request itself fails (network, 429, 5xx). */
export const LYNQ_ERROR_MESSAGE = "Sorry, I couldn't connect. Please try again in a moment."

/** Deck §1.3 default WhatsApp message — used by the contact action chip. */
export const LYNQ_WHATSAPP_MESSAGE = 'Hi TradeLynq, I need some help.'

/**
 * The support `wa.me` link for the contact action and the session-limit note.
 * Follows TokenInvalid's accept-or-refuse discipline: an unparseable support
 * number yields no link rather than a broken one.
 */
export function lynqSupportHref(): string | undefined {
  const digits = whatsappDigits(SUPPORT_PHONE)
  if (!digits) return undefined
  return `https://wa.me/${digits}?text=${encodeURIComponent(LYNQ_WHATSAPP_MESSAGE)}`
}
