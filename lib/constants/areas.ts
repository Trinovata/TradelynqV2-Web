/**
 * Trinidad & Tobago area listing (ported from V1 lib/constants/areas.ts —
 * proven data, unchanged). Organised by the recognised geographical regions;
 * granularity is towns, boroughs, and major villages — enough for client
 * familiarity without postal-level detail.
 *
 * The slug helpers exist for the programmatic SEO pages (playbook S087,
 * v2/03 §3.7): /professionals/[category]/[area] needs a stable, URL-safe,
 * reversible identity for every area ("St. Ann's" ↔ "st-anns").
 */

export type TrinidadRegion =
  'West' | 'North' | 'East' | 'East Coast' | 'Central' | 'South' | 'Tobago'

export type AreaGroup = {
  region: TrinidadRegion
  areas: string[]
}

export const TRINIDAD_AREA_GROUPS: AreaGroup[] = [
  {
    region: 'West',
    areas: [
      'Port of Spain',
      'Woodbrook',
      'St. Clair',
      'Newtown',
      'Belmont',
      'Laventille',
      'Morvant',
      'St. James',
      'Cascade',
      "St. Ann's",
    ],
  },
  {
    region: 'North',
    areas: [
      'Maraval',
      'Diego Martin',
      'Petit Valley',
      'Carenage',
      'Chaguaramas',
      'Blanchisseuse',
      'Maracas',
      'Las Cuevas',
      'Paramin',
      'Santa Cruz',
      'Lopinot',
    ],
  },
  {
    region: 'East',
    areas: [
      'San Juan',
      'Barataria',
      'Curepe',
      'St. Augustine',
      'Tunapuna',
      'Arouca',
      'Arima',
      "D'Abadie",
      'Malabar',
      'Trincity',
      'Maloney',
      'Piarco',
    ],
  },
  {
    region: 'East Coast',
    areas: [
      'Valencia',
      'Sangre Grande',
      'Manzanilla',
      'Mayaro',
      'Guayaguayare',
      'Toco',
      'Balandra',
      'Rio Claro',
    ],
  },
  {
    region: 'Central',
    areas: [
      'Chaguanas',
      'Cunupia',
      'Felicity',
      'Endeavour',
      'Longdenville',
      'Chase Village',
      'Freeport',
      'Montserrat',
      'Carapichaima',
      'Couva',
      'Claxton Bay',
      'Tabaquite',
    ],
  },
  {
    region: 'South',
    areas: [
      'Marabella',
      'San Fernando',
      'Mon Repos',
      'Gasparillo',
      'Ste. Madeleine',
      'Debe',
      'Penal',
      'Princes Town',
      'Siparia',
      'Fyzabad',
      'La Brea',
      'Point Fortin',
    ],
  },
  {
    region: 'Tobago',
    areas: [
      'Scarborough',
      'Crown Point',
      'Canaan',
      'Signal Hill',
      'Buccoo',
      'Plymouth',
      'Speyside',
      'Roxborough',
      'Charlotteville',
      'Castara',
      'Moriah',
      'Mason Hall',
      'Glamorgan',
      'Patience Hill',
    ],
  },
]

/** Flat list of every area, in region order. */
export const ALL_AREAS: string[] = TRINIDAD_AREA_GROUPS.flatMap((g) => g.areas)

/**
 * "St. Ann's" → "st-anns". Deterministic and collision-free over ALL_AREAS
 * (asserted by unit test, not assumed — two areas collapsing to one slug
 * would silently merge their pages).
 */
export function slugifyArea(area: string): string {
  return area
    .toLowerCase()
    .replace(/[''.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** slug → display name, for reversing a URL segment. */
export const AREA_BY_SLUG: ReadonlyMap<string, string> = new Map(
  ALL_AREAS.map((area) => [slugifyArea(area), area])
)

/**
 * The area's group, for "Nearby areas" cross-links (§3.7): nearby = the same
 * geographical region — honest adjacency without a distance model.
 */
export function areasNearby(area: string, limit = 6): string[] {
  const group = TRINIDAD_AREA_GROUPS.find((g) => g.areas.includes(area))
  if (!group) return []
  return group.areas.filter((a) => a !== area).slice(0, limit)
}
