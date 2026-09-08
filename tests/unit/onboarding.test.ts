import { describe, expect, it } from 'vitest'
import {
  BIO_MAX,
  BIO_MIN,
  draftCompleteness,
  draftSchema,
  emptyDraft,
  isStepComplete,
  publishSchema,
  resumeStep,
  stepSchemas,
  type OnboardingDraft,
} from '@/lib/professional/onboarding'

const CATEGORY_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'

/** A draft that would publish. Tests mutate copies of it to isolate one rule. */
function completeDraft(): OnboardingDraft {
  return {
    ...emptyDraft(),
    businessName: 'Persad Plumbing',
    ownerName: 'Anand Persad',
    categoryId: CATEGORY_ID,
    serviceAreas: ['Chaguanas', 'Couva'],
    yearsExperience: 12,
    bio: 'x'.repeat(BIO_MIN),
    profilePhotoUrl: 'https://example.supabase.co/storage/v1/object/public/a.jpg',
    services: [{ name: 'General plumbing repair', price_ttd: 350 }],
    contactWhatsapp: '868 000 0000',
  }
}

describe('step validation (S107 — the gate between steps)', () => {
  it('accepts a complete step 1', () => {
    expect(stepSchemas[1].safeParse(completeDraft()).success).toBe(true)
  })

  it('requires a category — a professional with none is invisible to search', () => {
    const result = stepSchemas[1].safeParse({ ...completeDraft(), categoryId: null })
    expect(result.success).toBe(false)
  })

  it('requires at least one service area', () => {
    const result = stepSchemas[1].safeParse({ ...completeDraft(), serviceAreas: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.serviceAreas?.[0]).toBe('Choose at least one area.')
    }
  })

  it('holds the bio between 50 and 500 characters', () => {
    expect(stepSchemas[2].safeParse({ ...completeDraft(), bio: 'too short' }).success).toBe(false)
    expect(
      stepSchemas[2].safeParse({ ...completeDraft(), bio: 'x'.repeat(BIO_MAX + 1) }).success
    ).toBe(false)
    expect(stepSchemas[2].safeParse({ ...completeDraft(), bio: 'x'.repeat(BIO_MAX) }).success).toBe(
      true
    )
  })

  it('needs at least one named service', () => {
    expect(stepSchemas[3].safeParse({ services: [] }).success).toBe(false)
    expect(stepSchemas[3].safeParse({ services: [{ name: 'Rewiring' }] }).success).toBe(true)
  })

  it('treats an empty step 4 as valid — proof is skippable', () => {
    expect(stepSchemas[4].safeParse({ portfolioUrls: [], seedReviews: [] }).success).toBe(true)
    expect(isStepComplete(emptyDraft(), 4)).toBe(true)
  })
})

describe('isStepComplete / resumeStep', () => {
  it('ignores blank service rows, which are the form’s empty state not data', () => {
    const draft = { ...completeDraft(), services: [{ name: 'Rewiring' }, { name: '   ' }] }
    expect(isStepComplete(draft, 3)).toBe(true)
  })

  it('resumes on the first INCOMPLETE step, not the furthest reached', () => {
    // Someone who got to step 4 and then cleared their bio must land on step 2,
    // otherwise they sit on a publish screen they cannot publish from.
    const draft = { ...completeDraft(), bio: '' }
    expect(resumeStep(draft)).toBe(2)
  })

  it('resumes at step 4 when everything required is done', () => {
    expect(resumeStep(completeDraft())).toBe(4)
  })

  it('starts a fresh professional at step 1', () => {
    expect(resumeStep(emptyDraft())).toBe(1)
  })
})

describe('draftCompleteness', () => {
  it('is zero for an empty draft and rises with each real field', () => {
    expect(draftCompleteness(emptyDraft())).toBe(0)
    const partial = { ...emptyDraft(), businessName: 'Persad Plumbing', ownerName: 'Anand' }
    expect(draftCompleteness(partial)).toBeGreaterThan(0)
    expect(draftCompleteness(partial)).toBeLessThan(1)
  })

  it('does not count a bio that is too short to publish', () => {
    const short = { ...emptyDraft(), bio: 'x'.repeat(BIO_MIN - 1) }
    expect(draftCompleteness(short)).toBe(0)
  })
})

describe('draftSchema (the autosave body)', () => {
  it('accepts a half-typed draft — every field is optional mid-step', () => {
    expect(draftSchema.safeParse({ businessName: 'Per' }).success).toBe(true)
    expect(draftSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a service row with no name yet, which publish would reject', () => {
    expect(draftSchema.safeParse({ services: [{ name: '' }] }).success).toBe(true)
    expect(stepSchemas[3].safeParse({ services: [{ name: '' }] }).success).toBe(false)
  })

  it('refuses a step outside 1–5 and an over-long business name', () => {
    expect(draftSchema.safeParse({ step: 9 }).success).toBe(false)
    expect(draftSchema.safeParse({ businessName: 'x'.repeat(81) }).success).toBe(false)
  })

  it('does not carry seeded reviews — they are written at publish, to another table', () => {
    const parsed = draftSchema.parse({
      businessName: 'Persad Plumbing',
      seedReviews: [
        { customer_name: 'Ravi', phone: '8681234567', rating: 5, text: 'x'.repeat(25) },
      ],
    })
    expect(parsed).not.toHaveProperty('seedReviews')
  })
})

describe('subtypeDocPath (credentials must stay in the private bucket)', () => {
  const UUID_A = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'
  const UUID_B = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

  it('accepts a storage path in the uploader’s own folder', () => {
    const path = `${UUID_A}/credentials/${UUID_B}.pdf`
    expect(draftSchema.safeParse({ subtypeDocPath: path }).success).toBe(true)
  })

  it('accepts the image forms a phone produces', () => {
    for (const ext of ['jpg', 'png', 'webp']) {
      const path = `${UUID_A}/credentials/${UUID_B}.${ext}`
      expect(draftSchema.safeParse({ subtypeDocPath: path }).success).toBe(true)
    }
  })

  // The bug this replaced: credentials went to the PUBLIC bucket and the draft
  // stored getPublicUrl(). A Certificate of Incorporation was world-readable by
  // URL. Storing a public URL here must now be impossible.
  it('rejects a public URL', () => {
    const url = 'https://example.supabase.co/storage/v1/object/public/professional-assets/a.jpg'
    expect(draftSchema.safeParse({ subtypeDocPath: url }).success).toBe(false)
  })

  it('rejects traversal out of the credentials folder', () => {
    for (const bad of [
      `../${UUID_A}/credentials/${UUID_B}.pdf`,
      `/${UUID_A}/credentials/${UUID_B}.pdf`,
      `${UUID_A}/portfolio/${UUID_B}.pdf`,
      `${UUID_A}/credentials/../../${UUID_B}.pdf`,
    ]) {
      expect(draftSchema.safeParse({ subtypeDocPath: bad }).success).toBe(false)
    }
  })

  it('rejects an executable masquerading as a document', () => {
    const path = `${UUID_A}/credentials/${UUID_B}.exe`
    expect(draftSchema.safeParse({ subtypeDocPath: path }).success).toBe(false)
  })

  it('still accepts null — the document is optional until publish', () => {
    expect(draftSchema.safeParse({ subtypeDocPath: null }).success).toBe(true)
  })
})

describe('publishSchema', () => {
  it('demands an explicit confirmation', () => {
    expect(publishSchema.safeParse({}).success).toBe(false)
    expect(publishSchema.safeParse({ confirmed: false }).success).toBe(false)
    expect(publishSchema.safeParse({ confirmed: true }).success).toBe(true)
  })

  it('holds seeded review testimonials to the reviews table’s own 20–300 window', () => {
    const review = { customer_name: 'Ravi', phone: '868 123 4567', rating: 5 }
    expect(
      publishSchema.safeParse({ confirmed: true, seedReviews: [{ ...review, text: 'Great job' }] })
        .success
    ).toBe(false)
    expect(
      publishSchema.safeParse({
        confirmed: true,
        seedReviews: [{ ...review, text: 'x'.repeat(301) }],
      }).success
    ).toBe(false)
    expect(
      publishSchema.safeParse({
        confirmed: true,
        seedReviews: [{ ...review, text: 'x'.repeat(25) }],
      }).success
    ).toBe(true)
  })

  it('rejects a phone number with too few digits to ring', () => {
    const result = publishSchema.safeParse({
      confirmed: true,
      seedReviews: [{ customer_name: 'Ravi', phone: '12345', rating: 5, text: 'x'.repeat(25) }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts the many ways a T&T number gets written', () => {
    for (const phone of ['868-123-4567', '+1 868 123 4567', '1(868)1234567', '123 4567']) {
      const result = publishSchema.safeParse({
        confirmed: true,
        seedReviews: [{ customer_name: 'Ravi', phone, rating: 5, text: 'x'.repeat(25) }],
      })
      expect(result.success, phone).toBe(true)
    }
  })

  it('rejects a rating outside 1–5, which the DB CHECK would reject anyway', () => {
    const base = { customer_name: 'Ravi', phone: '8681234567', text: 'x'.repeat(25) }
    expect(
      publishSchema.safeParse({ confirmed: true, seedReviews: [{ ...base, rating: 0 }] }).success
    ).toBe(false)
    expect(
      publishSchema.safeParse({ confirmed: true, seedReviews: [{ ...base, rating: 6 }] }).success
    ).toBe(false)
  })
})
