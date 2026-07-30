/**
 * Pricing v3.1 — the single source of truth for money on this platform.
 *
 * Every price rendered anywhere (the pricing page, upgrade prompts, checkout,
 * emails, the mobile apps) derives from this file. Changing a price here changes
 * it everywhere with no copy edits. A hardcoded price in a component is a bug,
 * and the acceptance test for S088 is exactly that: edit a value here and the
 * pricing page must follow.
 *
 * All amounts are whole TTD per month unless stated. Render with `formatTTD`.
 */

// ── Tiers ────────────────────────────────────────────────────────────────────

export type TierId = 'presence' | 'growth' | 'studio' | 'pro' | 'enterprise'

export type TierFeatures = {
  /** Client CRM — contacts, history, tags. */
  crm: boolean
  /** Monthly tool-credit allowance. */
  tool_credits: number
  /** Outbound webhooks (Enterprise integration). */
  webhooks: boolean
  /** n8n automation hooks. */
  n8n: boolean
}

export type Tier = {
  id: TierId
  name: string
  /** Monthly price in TTD. Enterprise is a floor, not a fixed price. */
  monthly: number
  /** One-sentence positioning, used on the pricing page and upgrade prompts. */
  summary: string
  features: TierFeatures
  /**
   * What this tier adds over the one below. The pricing page renders
   * differences only — "Everything in Presence, plus…" — because a full
   * feature list repeated five times is unreadable.
   */
  adds: readonly string[]
}

export const TIERS: Record<TierId, Tier> = {
  presence: {
    id: 'presence',
    name: 'Presence',
    monthly: 200,
    summary: 'A verified storefront customers can find and contact.',
    features: { crm: false, tool_credits: 0, webhooks: false, n8n: false },
    adds: [
      'Verified public storefront',
      'Appear in search and category pages',
      'Receive enquiries',
      'Collect reviews',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    monthly: 700,
    summary: 'Quote, invoice, and keep the work moving.',
    features: { crm: false, tool_credits: 50, webhooks: false, n8n: false },
    adds: ['Quotes and invoices', '50 tool credits a month', 'Job pipeline', 'Basic analytics'],
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    monthly: 1300,
    summary: 'Keep track of clients, not just jobs.',
    features: { crm: true, tool_credits: 200, webhooks: false, n8n: false },
    adds: ['Client CRM', '200 tool credits a month', 'AI reply drafts', 'Recurring invoices'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthly: 2100,
    summary: 'The full workspace, with the assistant.',
    features: { crm: true, tool_credits: 500, webhooks: false, n8n: false },
    adds: ['AI assistant', '500 tool credits a month', 'Priority support', 'Advanced analytics'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthly: 3500,
    summary: 'Integrate TradeLynq with the systems you already run.',
    features: { crm: true, tool_credits: Number.POSITIVE_INFINITY, webhooks: true, n8n: true },
    adds: [
      'Unlimited tool credits',
      'Outbound webhooks',
      'n8n automations',
      'White-label documents',
    ],
  },
} as const

/** Display order, cheapest first. */
export const TIER_ORDER: readonly TierId[] = ['presence', 'growth', 'studio', 'pro', 'enterprise']

/**
 * The tier highlighted on the pricing page. Exactly one, and it is the only
 * emphasis on that page — competing highlights emphasise nothing.
 */
export const RECOMMENDED_TIER: TierId = 'growth'

/** Enterprise is quoted from a floor; every other tier is an exact price. */
export function isPriceFrom(tier: TierId): boolean {
  return tier === 'enterprise'
}

// ── The crossover model ──────────────────────────────────────────────────────

/**
 * Account-type pricing, charged ON TOP of the tier as a second subscription
 * item so one invoice itemises both transparently.
 *
 * The intent: registration is cheaper, permanently, and the difference is
 * visible before you commit. A registered business pays a flat TTD $100/mo
 * forever. An unregistered sole trader pays nothing extra for six paid months,
 * then TTD $150/mo — more than the registered rate, and that gap is the nudge.
 *
 * Students are on the registered path's rate while they study.
 */
export const CROSSOVER = {
  /** Registered businesses: flat, forever, from day one. */
  registeredMonthly: 100,
  /** Unregistered sole traders: nothing for the grace period, then this. */
  standardMonthly: 150,
  /** Paid months before the standard rate begins. */
  gracePaidMonths: 6,
  /** Advance notice before the rate changes, in days. */
  noticeDays: [30, 7] as const,
} as const

export type AccountTrack = 'student' | 'sole_trader' | 'registered'

/**
 * The account-type surcharge for a given track at a given point in its life.
 *
 * @param paidMonths  Completed PAID months. Free Pioneer months do not count —
 *                    the grace period is measured in months actually billed, so
 *                    a Pioneer's clock starts when their first invoice is paid.
 */
export function accountSurcharge(track: AccountTrack, paidMonths: number): number {
  if (track === 'registered' || track === 'student') return CROSSOVER.registeredMonthly
  return paidMonths >= CROSSOVER.gracePaidMonths ? CROSSOVER.standardMonthly : 0
}

/** Total monthly charge: tier plus account-type surcharge. */
export function monthlyTotal(tier: TierId, track: AccountTrack, paidMonths: number): number {
  return TIERS[tier].monthly + accountSurcharge(track, paidMonths)
}

// ── Registration fee ─────────────────────────────────────────────────────────

/** One-time, all tiers, charged at signup. Students pay the reduced rate. */
export const REGISTRATION_FEE = {
  standard: 200,
  student: 100,
} as const

// ── Pioneer programme ────────────────────────────────────────────────────────

/**
 * The first 180 professionals get three months free.
 *
 * The per-category cap matters more than the headline number: 180 professionals
 * all in one category is a directory with one useful page. Capping at 3 per
 * child category forces the free months to buy BREADTH of supply, which is what
 * makes the marketplace searchable at launch.
 *
 * The registration fee still applies — free months are a subscription discount,
 * not a free account.
 */
export const PIONEER = {
  totalCap: 180,
  perCategoryCap: 3,
  freeMonths: 3,
  /** Backstop: the programme closes on this date even if the cap is unfilled. */
  backstopDate: '2027-01-07',
} as const

// ── Tool credits ─────────────────────────────────────────────────────────────

export type CreditBundle = {
  credits: number
  priceTTD: number
}

export const CREDIT_BUNDLES: readonly CreditBundle[] = [
  { credits: 100, priceTTD: 150 },
  { credits: 300, priceTTD: 400 },
  { credits: 1000, priceTTD: 1000 },
] as const

/** Cost per credit, for the "better value" hint on larger bundles. */
export function creditUnitCost(bundle: CreditBundle): number {
  return bundle.priceTTD / bundle.credits
}

// ── Feature gating ───────────────────────────────────────────────────────────

export type FeatureKey = keyof TierFeatures

/** Does this tier include the feature? Credits count as included when non-zero. */
export function tierHasFeature(tier: TierId, feature: FeatureKey): boolean {
  const value = TIERS[tier].features[feature]
  return typeof value === 'number' ? value > 0 : value
}

/**
 * The cheapest tier that unlocks a feature.
 *
 * Powers the `TIER_UPGRADE_REQUIRED` error payload, so an upgrade prompt names
 * the lowest sufficient tier rather than pushing everyone to Enterprise.
 */
export function lowestTierWith(feature: FeatureKey): TierId {
  const found = TIER_ORDER.find((tier) => tierHasFeature(tier, feature))
  // Every feature is included by Enterprise by construction; the fallback keeps
  // the return type total rather than optional.
  return found ?? 'enterprise'
}

// ── Billing periods (Gregg directive, 25 Jul 2026 — D-entry pending) ─────────

/**
 * Commit-length pricing: the longer the package, the cheaper the month. The
 * ladder replaces the earlier monthly/annual toggle (deck §9.2's "2 months
 * free on annual" flag is now resolved BY this model — 12 months IS 2 months
 * free, exactly).
 *
 * Totals are computed total-first so the arithmetic lands on clean TTD:
 * 12 months = monthly × 10 (two months free), 6 months = ×0.90, 3 = ×0.95.
 * The per-month figure shown on a card is the derived total ÷ months — the
 * struck monthly price beside it is the anchor that makes the saving legible.
 */
export type BillingPeriodMonths = 1 | 3 | 6 | 12

export const BILLING_PERIODS: ReadonlyArray<{
  months: BillingPeriodMonths
  label: string
  multiplier: number
  /** The chip on the toggle. Null for the base period — no fake zero-savings. */
  savingsLabel: string | null
}> = [
  { months: 1, label: 'Monthly', multiplier: 1, savingsLabel: null },
  { months: 3, label: '3 months', multiplier: 0.95, savingsLabel: 'Save 5%' },
  { months: 6, label: '6 months', multiplier: 0.9, savingsLabel: 'Save 10%' },
  { months: 12, label: '12 months', multiplier: 10 / 12, savingsLabel: '2 months free' },
]

/** The package total for a tier over a period, in whole TTD. */
export function periodTotal(tier: TierId, months: BillingPeriodMonths): number {
  const period = BILLING_PERIODS.find((p) => p.months === months)
  return Math.round(TIERS[tier].monthly * months * (period?.multiplier ?? 1))
}

/** The effective per-month rate for the period — the number the card leads with. */
export function periodPerMonth(tier: TierId, months: BillingPeriodMonths): number {
  return Math.round(periodTotal(tier, months) / months)
}

/** What the package saves against paying monthly, in whole TTD (0 for monthly). */
export function periodSavings(tier: TierId, months: BillingPeriodMonths): number {
  return TIERS[tier].monthly * months - periodTotal(tier, months)
}
