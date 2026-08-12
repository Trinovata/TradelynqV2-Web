/**
 * Formatting is where the canon is most often broken, and money is the case that
 * actually costs something: Trinidad & Tobago shares the dollar sign with the US,
 * so an unlabelled "$2,100" reads as roughly seven times its real price to anyone
 * who assumes USD.
 */
import { describe, it, expect } from 'vitest'
import {
  formatTTD,
  formatTTDRange,
  formatFromPrice,
  formatRating,
  formatReviewCount,
  formatReviewerName,
  normalisePhone,
  formatPhone,
  whatsappLink,
  truncate,
  formatDate,
} from '@/lib/utils/format'

describe('formatTTD — the currency law', () => {
  it('renders the canonical TTD $X,XXX shape', () => {
    expect(formatTTD(2100)).toBe('TTD $2,100')
    expect(formatTTD(200)).toBe('TTD $200')
    expect(formatTTD(3500)).toBe('TTD $3,500')
  })

  it('groups thousands', () => {
    expect(formatTTD(1300)).toBe('TTD $1,300')
    expect(formatTTD(1000000)).toBe('TTD $1,000,000')
  })

  it('omits cents by default and shows them on request', () => {
    expect(formatTTD(1234.56)).toBe('TTD $1,235')
    expect(formatTTD(1234.56, { decimals: true })).toBe('TTD $1,234.56')
  })

  it('distinguishes a missing price from a free one', () => {
    // "TTD $0" would claim the service is free. It is not the same fact.
    expect(formatTTD(null)).toBe('—')
    expect(formatTTD(undefined)).toBe('—')
    expect(formatTTD(Number.NaN)).toBe('—')
    expect(formatTTD(0)).toBe('TTD $0')
  })

  it('uses a true minus sign for negatives, not a hyphen', () => {
    expect(formatTTD(-500)).toBe('−TTD $500')
  })

  it('never emits a bare dollar sign', () => {
    for (const value of [0, 1, 999, 1000, 250000]) {
      expect(formatTTD(value)).toMatch(/^−?TTD \$/)
    }
  })

  it('covers every pricing v3.1 tier at its exact value', () => {
    expect(formatTTD(200)).toBe('TTD $200')
    expect(formatTTD(700)).toBe('TTD $700')
    expect(formatTTD(1300)).toBe('TTD $1,300')
    expect(formatTTD(2100)).toBe('TTD $2,100')
    expect(formatTTD(3500)).toBe('TTD $3,500')
  })
})

describe('formatTTDRange', () => {
  it('prefixes the currency once, not twice', () => {
    // Repeating "TTD $" reads as two separate prices rather than one range.
    expect(formatTTDRange(200, 700)).toBe('TTD $200 – $700')
  })

  it('collapses to a single price when the bounds match', () => {
    expect(formatTTDRange(500, 500)).toBe('TTD $500')
  })
})

describe('formatFromPrice', () => {
  it('renders the storefront label', () => {
    expect(formatFromPrice(150)).toBe('From TTD $150')
  })

  it('renders nothing when there is no price, rather than "From —"', () => {
    expect(formatFromPrice(null)).toBe('')
  })
})

describe('formatReviewerName — public review masking', () => {
  it('reduces to first name and last initial', () => {
    // Reviews are public and permanent; in a country this small a full name
    // attached to a public opinion about a named business is an identification.
    expect(formatReviewerName('Nia Ramkissoon')).toBe('Nia R.')
    expect(formatReviewerName('Kwame Anthony Baptiste')).toBe('Kwame B.')
  })

  it('leaves a single name unchanged', () => {
    expect(formatReviewerName('Nia')).toBe('Nia')
  })

  it('falls back without inventing a name', () => {
    expect(formatReviewerName(null)).toBe('A customer')
    expect(formatReviewerName('   ')).toBe('A customer')
  })

  it('tolerates irregular spacing', () => {
    expect(formatReviewerName('  Nia   Ramkissoon  ')).toBe('Nia R.')
  })
})

describe('normalisePhone — T&T formats people actually type', () => {
  it('expands a local seven-digit number', () => {
    expect(normalisePhone('374-1234')).toBe('18683741234')
  })

  it('adds the country code to a ten-digit number', () => {
    expect(normalisePhone('868 374 1234')).toBe('18683741234')
  })

  it('accepts fully qualified input in either form', () => {
    expect(normalisePhone('+1 868 374 1234')).toBe('18683741234')
    expect(normalisePhone('18683741234')).toBe('18683741234')
  })

  it('strips punctuation people use', () => {
    expect(normalisePhone('(868) 374-1234')).toBe('18683741234')
  })

  it('refuses rather than guesses when input is unusable', () => {
    // A wrong number fails silently at the WhatsApp layer, so guessing is worse
    // than refusing.
    expect(normalisePhone('123')).toBeNull()
    expect(normalisePhone('')).toBeNull()
    expect(normalisePhone(null)).toBeNull()
  })
})

describe('formatPhone', () => {
  it('renders the display form', () => {
    expect(formatPhone('3741234')).toBe('+1 (868) 374-1234')
  })

  it('shows the raw value rather than an error when unparseable', () => {
    expect(formatPhone('123')).toBe('123')
    expect(formatPhone(null)).toBe('—')
  })
})

describe('whatsappLink', () => {
  it('builds a wa.me link from any accepted format', () => {
    expect(whatsappLink('374-1234')).toBe('https://wa.me/18683741234')
  })

  it('URL-encodes the pre-filled context message', () => {
    const link = whatsappLink('3741234', 'Hi! I found you on TradeLynq & wanted a quote.')
    expect(link).toContain('?text=')
    expect(link).toContain('%26') // the ampersand must not break the query string
    expect(link).not.toContain(' ')
  })

  it('returns null for an unusable number so callers can hide the CTA', () => {
    expect(whatsappLink('bad')).toBeNull()
  })
})

describe('formatRating / formatReviewCount', () => {
  it('always shows one decimal so ratings align in a column', () => {
    expect(formatRating(5)).toBe('5.0')
    expect(formatRating(4.75)).toBe('4.8')
  })

  it('shows an em dash when unrated rather than 0.0', () => {
    // "0.0" would read as a terrible rating rather than no rating at all.
    expect(formatRating(null)).toBe('—')
  })

  it('parenthesises and groups the count', () => {
    expect(formatReviewCount(23)).toBe('(23)')
    expect(formatReviewCount(1234)).toBe('(1,234)')
  })
})

describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('Short', 20)).toBe('Short')
  })

  it('breaks on a word boundary', () => {
    expect(truncate('The quick brown fox jumps', 15)).toBe('The quick brown…')
  })

  it('does not gut the string when there is no late word break', () => {
    const result = truncate('Supercalifragilisticexpialidocious', 10)
    expect(result).toBe('Supercalif…')
  })
})

describe('formatDate', () => {
  it('renders day-first, per Commonwealth convention', () => {
    expect(formatDate('2026-07-19T12:00:00Z')).toContain('July')
    expect(formatDate('2026-07-19T12:00:00Z')).toMatch(/^\d{1,2} July 2026$/)
  })

  it('renders a date-ONLY string as that calendar date, not the day before', () => {
    // '2027-03-31' parses as UTC midnight per the spec; unpinned, it rendered
    // "30 March 2027" in Trinidad (UTC-4). The launch free-window date and the
    // Pioneer backstop are both date-only strings, so this is user-visible.
    expect(formatDate('2027-03-31')).toBe('31 March 2027')
    expect(formatDate('2027-01-07')).toBe('7 January 2027')
  })

  it('does not throw on invalid input', () => {
    expect(formatDate('not a date')).toBe('—')
  })
})
