/**
 * Onboarding contract (playbook S107, spec `v2/05 §5.2`, copy `copy-professional.md §4`).
 *
 * Shared by the wizard (client), the draft-save route, and the publish route —
 * so the shape a professional types, the shape the browser autosaves, and the
 * shape the server validates are one definition rather than three that drift.
 *
 * Deliberately NOT `server-only`: the wizard imports the schemas to validate a
 * step before advancing, which is the whole reason the file exists. Nothing
 * here reads the database or touches a secret.
 *
 * ## Why the draft is stored server-side at all
 *
 * The spec asks for localStorage autosave, and the wizard does that — but
 * localStorage alone loses everything when someone starts on their phone and
 * finishes on a laptop, and the 24h abandonment nudge (`v2/08 §8.6`) needs a
 * server row to know who to nudge and how far they got. So each step commits to
 * `professional_profiles` as a draft row (`listing_status = 'draft'`,
 * `onboarding_step = n`) and localStorage is the fast path in front of it.
 */

// ── Shapes ───────────────────────────────────────────────────────────────────

import { z } from 'zod'

export type OnboardingService = {
  name: string
  price_ttd?: number
  description?: string
}

export type OnboardingSeedReview = {
  customer_name: string
  phone: string
  rating: number
  text: string
}

export type OnboardingDraft = {
  // Step 1 — business basics
  businessName: string
  ownerName: string
  categoryId: string | null
  serviceAreas: string[]
  yearsExperience: number | null
  /** Student track: proof of enrolment. Registered track: incorporation doc. */
  subtypeDocPath: string | null
  birNumber: string
  // Step 2 — about
  profilePhotoUrl: string | null
  bio: string
  // Step 3 — services & prices
  services: OnboardingService[]
  // Step 4 — proof (skippable)
  portfolioUrls: string[]
  seedReviews: OnboardingSeedReview[]
  // Step 5 — contact, so the storefront has a way to be reached on publish
  contactWhatsapp: string
}

export const ONBOARDING_STEPS = ['Basics', 'About', 'Services', 'Proof', 'Publish'] as const
export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length

/** localStorage key. Versioned, so a shape change cannot resurrect a stale draft. */
export const ONBOARDING_STORAGE_KEY = 'tradelynq_onboarding_v3'

export function emptyDraft(): OnboardingDraft {
  return {
    businessName: '',
    ownerName: '',
    categoryId: null,
    serviceAreas: [],
    yearsExperience: null,
    subtypeDocPath: null,
    birNumber: '',
    profilePhotoUrl: null,
    bio: '',
    services: [{ name: '' }],
    portfolioUrls: [],
    seedReviews: [],
    contactWhatsapp: '',
  }
}

// ── Validation ───────────────────────────────────────────────────────────────
//
// Messages are the deck's, verbatim (`copy-professional.md §4.1–4.4`). The
// wizard surfaces these strings directly, so inventing new ones here would put
// unreviewed copy in front of a professional at the highest-stakes moment.

export const BIO_MIN = 50
export const BIO_MAX = 500
/** Portfolio images accepted at onboarding. Storefront management raises this per plan. */
export const PORTFOLIO_LIMIT = 8

const serviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name this service.')
    .max(60, 'Keep the name under 60 characters.'),
  price_ttd: z
    .number()
    .int()
    .min(0, 'Enter a price, or leave it blank.')
    .max(10_000_000)
    .optional(),
  description: z.string().trim().max(200, 'Keep details under 200 characters.').optional(),
})

const seedReviewSchema = z.object({
  customer_name: z.string().trim().min(1, 'Add the customer’s name.').max(80),
  phone: z
    .string()
    .trim()
    // Deliberately permissive on shape, strict on substance: T&T numbers get
    // written a dozen ways (868-, 1868, +1 868, local 7-digit). Requiring a
    // canonical format here rejects real numbers; requiring enough digits
    // rejects typos. An admin phones these before any of them publish.
    .refine((v) => (v.match(/\d/g) ?? []).length >= 7, 'Enter a valid phone number.'),
  rating: z.number().int().min(1, 'Choose a star rating.').max(5),
  text: z
    .string()
    .trim()
    // The reviews table CHECKs 20–600 (D54). Matching it here turns a 500 from a
    // constraint violation into a field error the professional can act on.
    .min(20, 'Add a little more — at least 20 characters.')
    .max(300, 'Keep it under 300 characters.'),
})

/**
 * Per-step schemas. The wizard validates the current step before advancing; the
 * publish route validates all five, because a client that skipped a step is
 * exactly the client you cannot trust.
 */
export const stepSchemas = {
  1: z.object({
    businessName: z
      .string()
      .trim()
      .min(1, 'Add the name customers will know you by.')
      .max(80, 'Keep this under 80 characters.'),
    ownerName: z.string().trim().min(1, 'Add your name.'),
    categoryId: z.string().uuid('Choose a category so customers can find you.'),
    serviceAreas: z.array(z.string().trim().min(1)).min(1, 'Choose at least one area.').max(30),
    yearsExperience: z
      .number()
      .int()
      .min(0, 'Enter a number between 0 and 70.')
      .max(70, 'Enter a number between 0 and 70.')
      .nullable(),
  }),
  2: z.object({
    bio: z
      .string()
      .trim()
      .min(BIO_MIN, 'Add a little more — at least 50 characters.')
      .max(BIO_MAX, 'Keep it under 500 characters.'),
    profilePhotoUrl: z.string().url().nullable(),
  }),
  3: z.object({
    services: z.array(serviceSchema).min(1, 'Add at least one service to continue.').max(40),
  }),
  // Step 4 is skippable by design, so its schema only constrains what was
  // actually entered — an empty step 4 is a valid step 4.
  4: z.object({
    portfolioUrls: z.array(z.string().url()).max(PORTFOLIO_LIMIT),
    seedReviews: z.array(seedReviewSchema).max(10),
  }),
} as const

export type OnboardingStep = keyof typeof stepSchemas | 5

/**
 * The draft-save body: everything optional, because a save fires mid-step with
 * whatever exists so far. Validation of *completeness* belongs to publish; this
 * schema only guarantees each present field is well-formed enough to store.
 */
/**
 * A credential lives in the private `kyc-documents` bucket, so what is stored
 * is a storage path, never a URL. Pinning the shape here does double duty: it
 * rejects a stray public URL (the bug this replaced), and it forbids the `..`
 * and leading-slash forms that would try to address another user's folder.
 */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const CREDENTIAL_PATH = new RegExp(`^${UUID}/credentials/${UUID}[.](pdf|jpg|png|webp)$`, 'i')

export const draftSchema = z.object({
  step: z.number().int().min(1).max(5).optional(),
  businessName: z.string().trim().max(80).optional(),
  ownerName: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  serviceAreas: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  yearsExperience: z.number().int().min(0).max(70).nullable().optional(),
  subtypeDocPath: z
    .string()
    .max(600)
    .regex(CREDENTIAL_PATH, "Not a credential storage path.")
    .nullable()
    .optional(),
  birNumber: z.string().trim().max(40).optional(),
  profilePhotoUrl: z.string().url().max(600).nullable().optional(),
  bio: z.string().trim().max(BIO_MAX).optional(),
  // A half-typed row is normal mid-step, so the draft accepts a loose service
  // and the publish schema is what insists on a name.
  services: z
    .array(
      z.object({
        name: z.string().trim().max(60),
        price_ttd: z.number().int().min(0).max(10_000_000).optional(),
        description: z.string().trim().max(200).optional(),
      })
    )
    .max(40)
    .optional(),
  portfolioUrls: z.array(z.string().url().max(600)).max(PORTFOLIO_LIMIT).optional(),
  contactWhatsapp: z.string().trim().max(40).optional(),
})

/** The publish body: the seeded reviews travel here rather than with the draft,
 *  because they are written to a different table under an admin-vouched flag. */
export const publishSchema = z.object({
  seedReviews: z.array(seedReviewSchema).max(10).optional(),
  /** The step-5 confirmation. Explicit rather than implied by calling publish. */
  confirmed: z.literal(true),
})

// ── Progress ─────────────────────────────────────────────────────────────────

/**
 * Whether a step's required fields are satisfied. Drives the "Continue" gate and
 * the step indicator's completed marks — one function so the two cannot
 * disagree about what "done" means.
 */
export function isStepComplete(draft: OnboardingDraft, step: number): boolean {
  switch (step) {
    case 1:
      return stepSchemas[1].safeParse(draft).success
    case 2:
      return stepSchemas[2].safeParse(draft).success
    case 3:
      return stepSchemas[3].safeParse({ services: draft.services.filter((s) => s.name.trim()) })
        .success
    case 4:
      return true
    default:
      return false
  }
}

/** First step still incomplete — where a returning professional resumes. */
export function resumeStep(draft: OnboardingDraft): number {
  for (const step of [1, 2, 3]) {
    if (!isStepComplete(draft, step)) return step
  }
  return 4
}

/**
 * Storefront completeness, 0–1. Shown as a progress read-out and used by the
 * abandonment nudge copy ("your storefront is 60% ready") so the number a
 * professional sees on screen is the number the message quotes.
 */
export function draftCompleteness(draft: OnboardingDraft): number {
  const signals = [
    draft.businessName.trim().length > 0,
    draft.ownerName.trim().length > 0,
    draft.categoryId !== null,
    draft.serviceAreas.length > 0,
    draft.bio.trim().length >= BIO_MIN,
    draft.profilePhotoUrl !== null,
    draft.services.some((s) => s.name.trim().length > 0),
    draft.portfolioUrls.length > 0,
    draft.contactWhatsapp.trim().length > 0,
  ]
  return signals.filter(Boolean).length / signals.length
}
