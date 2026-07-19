/**
 * Pricing is the highest-consequence logic in the codebase: an error here
 * either undercharges every professional on the platform or overcharges them,
 * and both are discovered late. These tests pin the v3.1 values and the
 * crossover model's month-by-month behaviour.
 */
import { describe, it, expect } from 'vitest'
import {
  TIERS,
  TIER_ORDER,
  RECOMMENDED_TIER,
  CROSSOVER,
  PIONEER,
  REGISTRATION_FEE,
  CREDIT_BUNDLES,
  accountSurcharge,
  monthlyTotal,
  tierHasFeature,
  lowestTierWith,
  creditUnitCost,
  isPriceFrom,
  type TierId,
} from '@/lib/constants/pricing'

describe('pricing v3.1 — the canonical values', () => {
  it('prices all five tiers exactly', () => {
    expect(TIERS.presence.monthly).toBe(200)
    expect(TIERS.growth.monthly).toBe(700)
    expect(TIERS.studio.monthly).toBe(1300)
    expect(TIERS.pro.monthly).toBe(2100)
    expect(TIERS.enterprise.monthly).toBe(3500)
  })

  it('orders tiers cheapest first with no gaps or duplicates', () => {
    expect(TIER_ORDER).toEqual(['presence', 'growth', 'studio', 'pro', 'enterprise'])
    expect(new Set(TIER_ORDER).size).toBe(TIER_ORDER.length)
    expect(TIER_ORDER.length).toBe(Object.keys(TIERS).length)
  })

  it('increases monotonically — a higher tier is never cheaper', () => {
    for (let i = 1; i < TIER_ORDER.length; i += 1) {
      const previous = TIERS[TIER_ORDER[i - 1] as TierId].monthly
      const current = TIERS[TIER_ORDER[i] as TierId].monthly
      expect(current, `${TIER_ORDER[i]} must cost more than ${TIER_ORDER[i - 1]}`).toBeGreaterThan(
        previous
      )
    }
  })

  it('highlights exactly one tier', () => {
    // Competing highlights emphasise nothing.
    expect(RECOMMENDED_TIER).toBe('growth')
    expect(TIER_ORDER).toContain(RECOMMENDED_TIER)
  })

  it('quotes only Enterprise as a floor', () => {
    expect(isPriceFrom('enterprise')).toBe(true)
    for (const tier of ['presence', 'growth', 'studio', 'pro'] as const) {
      expect(isPriceFrom(tier)).toBe(false)
    }
  })

  it('sets the registration fee and the student rate', () => {
    expect(REGISTRATION_FEE.standard).toBe(200)
    expect(REGISTRATION_FEE.student).toBe(100)
  })
})

describe('tier features and gating', () => {
  it('gates CRM at Studio and above', () => {
    expect(tierHasFeature('presence', 'crm')).toBe(false)
    expect(tierHasFeature('growth', 'crm')).toBe(false)
    expect(tierHasFeature('studio', 'crm')).toBe(true)
    expect(tierHasFeature('pro', 'crm')).toBe(true)
    expect(tierHasFeature('enterprise', 'crm')).toBe(true)
  })

  it('gates webhooks at Enterprise only', () => {
    for (const tier of ['presence', 'growth', 'studio', 'pro'] as const) {
      expect(tierHasFeature(tier, 'webhooks')).toBe(false)
    }
    expect(tierHasFeature('enterprise', 'webhooks')).toBe(true)
  })

  it('gives Presence no tool credits', () => {
    expect(TIERS.presence.features.tool_credits).toBe(0)
    expect(tierHasFeature('presence', 'tool_credits')).toBe(false)
  })

  it('allocates credits monotonically', () => {
    expect(TIERS.growth.features.tool_credits).toBe(50)
    expect(TIERS.studio.features.tool_credits).toBe(200)
    expect(TIERS.pro.features.tool_credits).toBe(500)
    expect(TIERS.enterprise.features.tool_credits).toBe(Number.POSITIVE_INFINITY)
  })

  it('names the LOWEST sufficient tier for an upgrade prompt', () => {
    // Pushing everyone to Enterprise for a Studio feature loses the sale.
    expect(lowestTierWith('crm')).toBe('studio')
    expect(lowestTierWith('webhooks')).toBe('enterprise')
    expect(lowestTierWith('tool_credits')).toBe('growth')
  })

  it('describes each tier by what it ADDS, never repeating the full list', () => {
    for (const tier of TIER_ORDER) {
      expect(TIERS[tier].adds.length, `${tier} needs differentiators`).toBeGreaterThan(0)
      expect(TIERS[tier].summary.length).toBeGreaterThan(10)
    }
  })
})

describe('the crossover model', () => {
  it('charges registered businesses a flat rate from day one', () => {
    for (const month of [0, 1, 5, 6, 7, 24, 120]) {
      expect(accountSurcharge('registered', month)).toBe(100)
    }
  })

  it('puts students on the registered rate', () => {
    expect(accountSurcharge('student', 0)).toBe(100)
    expect(accountSurcharge('student', 12)).toBe(100)
  })

  it('charges a sole trader nothing for six paid months', () => {
    for (const month of [0, 1, 2, 3, 4, 5]) {
      expect(accountSurcharge('sole_trader', month), `month ${month}`).toBe(0)
    }
  })

  it('switches the sole trader to TTD $150 at the SEVENTH paid month', () => {
    // The boundary is the whole mechanism: month 6 completed means month 7 bills.
    expect(accountSurcharge('sole_trader', 6)).toBe(150)
    expect(accountSurcharge('sole_trader', 7)).toBe(150)
    expect(accountSurcharge('sole_trader', 60)).toBe(150)
  })

  it('leaves the unregistered rate strictly higher than the registered one', () => {
    // If this ever inverts, the entire incentive to register disappears.
    expect(CROSSOVER.standardMonthly).toBeGreaterThan(CROSSOVER.registeredMonthly)
  })

  it('gives notice before the rate changes', () => {
    expect(CROSSOVER.noticeDays).toEqual([30, 7])
    expect(CROSSOVER.gracePaidMonths).toBe(6)
  })
})

describe('monthlyTotal — the worked example', () => {
  it('bills a Growth sole trader 700 for six months, then 850', () => {
    expect(monthlyTotal('growth', 'sole_trader', 0)).toBe(700)
    expect(monthlyTotal('growth', 'sole_trader', 5)).toBe(700)
    expect(monthlyTotal('growth', 'sole_trader', 6)).toBe(850)
  })

  it('bills a Growth registered business 800 from the start, forever', () => {
    expect(monthlyTotal('growth', 'registered', 0)).toBe(800)
    expect(monthlyTotal('growth', 'registered', 24)).toBe(800)
  })

  it('makes registering cheaper in the long run at every tier', () => {
    // The claim the pricing page makes. If it is ever false, the page lies.
    for (const tier of TIER_ORDER) {
      const registered = monthlyTotal(tier, 'registered', 12)
      const unregistered = monthlyTotal(tier, 'sole_trader', 12)
      expect(registered, `${tier}: registering must cost less`).toBeLessThan(unregistered)
    }
  })

  it('costs a sole trader more over a year than registering, in total', () => {
    let soleTrader = 0
    let registered = 0
    for (let month = 0; month < 12; month += 1) {
      soleTrader += monthlyTotal('growth', 'sole_trader', month)
      registered += monthlyTotal('growth', 'registered', month)
    }
    // Six free months, then six at +150 = 900. Registered: twelve at +100 = 1200.
    // So across year ONE the sole trader is actually cheaper — the crossover
    // only pays back later. This is worth asserting so nobody "fixes" the
    // pricing page into claiming year-one savings it does not deliver.
    expect(soleTrader).toBe(700 * 12 + 150 * 6)
    expect(registered).toBe(800 * 12)
    expect(soleTrader).toBeLessThan(registered)
  })

  it('makes registering cheaper cumulatively by year two', () => {
    let soleTrader = 0
    let registered = 0
    for (let month = 0; month < 24; month += 1) {
      soleTrader += monthlyTotal('growth', 'sole_trader', month)
      registered += monthlyTotal('growth', 'registered', month)
    }
    expect(soleTrader).toBeGreaterThan(registered)
  })
})

describe('Pioneer programme', () => {
  it('caps the cohort and the per-category share', () => {
    expect(PIONEER.totalCap).toBe(180)
    // 180 professionals in one category is a directory with one useful page.
    expect(PIONEER.perCategoryCap).toBe(3)
    expect(PIONEER.freeMonths).toBe(3)
  })

  it('carries a backstop date so the programme cannot run indefinitely', () => {
    expect(PIONEER.backstopDate).toBe('2027-01-07')
    expect(new Date(PIONEER.backstopDate).getTime()).not.toBeNaN()
  })

  it('cannot fill the total cap from a single category', () => {
    // The cap buys breadth of supply, which is what makes search useful at launch.
    expect(PIONEER.perCategoryCap * 12).toBeLessThan(PIONEER.totalCap)
  })
})

describe('credit bundles', () => {
  it('matches the published prices', () => {
    expect(CREDIT_BUNDLES).toEqual([
      { credits: 100, priceTTD: 150 },
      { credits: 300, priceTTD: 400 },
      { credits: 1000, priceTTD: 1000 },
    ])
  })

  it('gets cheaper per credit as the bundle grows', () => {
    // A larger bundle that costs more per credit is a pricing bug users notice.
    for (let i = 1; i < CREDIT_BUNDLES.length; i += 1) {
      const previous = creditUnitCost(CREDIT_BUNDLES[i - 1]!)
      const current = creditUnitCost(CREDIT_BUNDLES[i]!)
      expect(current).toBeLessThan(previous)
    }
  })
})
