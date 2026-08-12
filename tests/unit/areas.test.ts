import { describe, expect, it } from 'vitest'
import { ALL_AREAS, AREA_BY_SLUG, areasNearby, slugifyArea } from '@/lib/constants/areas'

describe('area slugs (S087 programmatic pages)', () => {
  it('slugs are URL-safe', () => {
    for (const area of ALL_AREAS) {
      expect(slugifyArea(area)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('slugs are collision-free over the full area list', () => {
    // Two areas collapsing to one slug would silently merge their SEO pages —
    // the comment in areas.ts promises this property; this test is the promise.
    const slugs = ALL_AREAS.map(slugifyArea)
    expect(new Set(slugs).size).toBe(ALL_AREAS.length)
  })

  it('every slug reverses to its display name', () => {
    for (const area of ALL_AREAS) {
      expect(AREA_BY_SLUG.get(slugifyArea(area))).toBe(area)
    }
  })

  it('apostrophes and periods vanish rather than become separators', () => {
    expect(slugifyArea("St. Ann's")).toBe('st-anns')
    expect(slugifyArea("D'Abadie")).toBe('dabadie')
  })

  it('nearby areas come from the same region and exclude the area itself', () => {
    const nearby = areasNearby('Chaguanas')
    expect(nearby).not.toContain('Chaguanas')
    expect(nearby.length).toBeGreaterThan(0)
    // Chaguanas is Central; Port of Spain is West — never "nearby".
    expect(nearby).not.toContain('Port of Spain')
  })

  it('unknown area yields no nearby links rather than a crash', () => {
    expect(areasNearby('Atlantis')).toEqual([])
  })
})
