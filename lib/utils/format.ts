/**
 * Formatting helpers for the canon's presentation rules.
 *
 * Money is the one people get wrong. The rule is absolute: `TTD $X,XXX`, never a
 * bare number, never USD, never a lone `$`. It exists because Trinidad & Tobago
 * shares the dollar sign with the US, and an unlabelled "$2,100" reads as roughly
 * seven times its real price to anyone who assumes USD. Every price on this
 * platform goes through `formatTTD`.
 */

/** The locale used for all number and date formatting. */
const LOCALE = 'en-TT'

/**
 * Formats an amount as Trinidad & Tobago dollars: `TTD $2,100`.
 *
 * @param amount  The value. Whole dollars unless `decimals` is set.
 * @param options.decimals  Show cents. Default false — prices are whole dollars;
 *                          invoices and payments are not, and pass true.
 */
export function formatTTD(
  amount: number | null | undefined,
  options: { decimals?: boolean } = {}
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    // An em dash, not "TTD $0" — a missing price and a free service are
    // different facts, and conflating them misleads.
    return '—'
  }

  const fractionDigits = options.decimals ? 2 : 0

  const formatted = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.abs(amount))

  const sign = amount < 0 ? '−' : ''
  return `${sign}TTD $${formatted}`
}

/**
 * Formats a price range: `TTD $200 – $700`.
 *
 * The currency prefix appears once. Repeating it reads as two separate prices
 * rather than one range.
 */
export function formatTTDRange(from: number, to: number): string {
  if (from === to) return formatTTD(from)
  const upper = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(to)
  return `${formatTTD(from)} – $${upper}`
}

/** `From TTD $200` — the storefront's cheapest-offering label. */
export function formatFromPrice(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return ''
  return `From ${formatTTD(amount)}`
}

// ── Dates ────────────────────────────────────────────────────────────────────

/** `19 July 2026` — day first, per Commonwealth convention. */
export function formatDate(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/** `19 Jul 2026` — for tables and cards where width is scarce. */
export function formatDateShort(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/**
 * Relative time: `2 hours ago`, `in 3 days`.
 *
 * Used for SLA chips and activity feeds, where "how long ago" is the question
 * being asked and an absolute timestamp forces the reader to do arithmetic.
 */
export function formatRelativeTime(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return '—'

  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const absolute = Math.abs(deltaSeconds)

  const formatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })

  const thresholds: ReadonlyArray<
    [limit: number, divisor: number, unit: Intl.RelativeTimeFormatUnit]
  > = [
    [60, 1, 'second'],
    [3600, 60, 'minute'],
    [86400, 3600, 'hour'],
    [604800, 86400, 'day'],
    [2629800, 604800, 'week'],
    [31557600, 2629800, 'month'],
  ]

  for (const [limit, divisor, unit] of thresholds) {
    if (absolute < limit) return formatter.format(Math.round(deltaSeconds / divisor), unit)
  }

  return formatter.format(Math.round(deltaSeconds / 31557600), 'year')
}

// ── People ───────────────────────────────────────────────────────────────────

/**
 * Masks a reviewer's name to first name plus last initial: `Nia R.`
 *
 * Reviews are public and permanent. A full name attached to a public opinion
 * about a named local business, in a country this small, is an identification.
 */
export function formatReviewerName(fullName: string | null | undefined): string {
  if (!fullName?.trim()) return 'A customer'

  const parts = fullName.trim().split(/\s+/)
  const first = parts[0] ?? ''
  if (parts.length === 1) return first

  const lastInitial = parts[parts.length - 1]?.charAt(0).toUpperCase() ?? ''
  return lastInitial ? `${first} ${lastInitial}.` : first
}

/** `4.8` — ratings always show one decimal, so 5 and 4.8 align in a column. */
export function formatRating(rating: number | null | undefined): string {
  if (rating === null || rating === undefined) return '—'
  return rating.toFixed(1)
}

/** `(23)` — the review count beside a rating. */
export function formatReviewCount(count: number): string {
  return `(${new Intl.NumberFormat(LOCALE).format(count)})`
}

// ── Phone ────────────────────────────────────────────────────────────────────

/**
 * Normalises a T&T phone number to E.164 digits, no leading `+`.
 *
 * Accepts what people actually type: `374-1234`, `(868) 374 1234`,
 * `+1 868 374 1234`. Returns null when it cannot be resolved confidently —
 * a wrong number fails silently at the WhatsApp layer, so guessing is worse
 * than refusing.
 */
export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null

  const stripped = raw.replace(/[^\d+]/g, '')

  if (stripped.startsWith('+')) {
    const digits = stripped.slice(1)
    return digits.length >= 10 ? digits : null
  }

  const digits = stripped

  // 1868XXXXXXX — already country-coded.
  if (digits.length === 11 && digits.startsWith('1')) return digits
  // 868XXXXXXX — NANP without the leading 1.
  if (digits.length === 10) return `1${digits}`
  // XXXXXXX — T&T local seven-digit.
  if (digits.length === 7) return `1868${digits}`

  return digits.length >= 10 ? digits : null
}

/** `+1 (868) 374-1234` — display form. Falls back to the raw input. */
export function formatPhone(raw: string | null | undefined): string {
  const normalised = normalisePhone(raw)
  if (!normalised) return raw ?? '—'

  if (normalised.length === 11 && normalised.startsWith('1')) {
    const area = normalised.slice(1, 4)
    const prefix = normalised.slice(4, 7)
    const line = normalised.slice(7)
    return `+1 (${area}) ${prefix}-${line}`
  }

  return `+${normalised}`
}

/**
 * Builds a `wa.me` link with an optional pre-filled message.
 *
 * WhatsApp is the primary support and contact channel in Trinidad & Tobago, so
 * this is a conversion path, not a convenience. The pre-filled context is what
 * stops a professional receiving "hi" with no idea which listing it concerns.
 */
export function whatsappLink(phone: string | null | undefined, message?: string): string | null {
  const normalised = normalisePhone(phone)
  if (!normalised) return null

  const base = `https://wa.me/${normalised}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

// ── Text ─────────────────────────────────────────────────────────────────────

/**
 * Truncates on a word boundary, appending an ellipsis character.
 *
 * Only breaks at a space if that space falls in the last 40% of the budget —
 * otherwise a long unbroken token would cut the string to almost nothing.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text

  const cut = text.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')
  const base = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut

  return `${base.trimEnd()}…`
}

/** `1,234` — counts and quantities, grouped. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value)
}
