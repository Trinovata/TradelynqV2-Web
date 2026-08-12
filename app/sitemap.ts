import type { MetadataRoute } from 'next'
import { getActiveStorefrontSlugs, getAllCategorySlugs } from '@/lib/marketplace/seo'

/**
 * Sitemap (playbook S087, spec v2/03 §3.7).
 *
 * Sections: static public pages, the 12 parent category landings, and every
 * active storefront. The ~3,600 category×area combinations are deliberately
 * NOT enumerated — most are zero-count (noindex) until supply fills in, and a
 * sitemap full of noindex URLs reads as spam to a crawler. FLAG: add the
 * populated combinations (a count-grouped query) once supply justifies it;
 * the spec's "split by type" (sitemap index) becomes worthwhile at the same
 * moment.
 *
 * Base URL: NEXT_PUBLIC_SITE_URL when set (S003/Vercel), else the production
 * domain — a sitemap of localhost URLs is worse than none.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tradelynq.tech'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ parents }, storefronts] = await Promise.all([
    getAllCategorySlugs(),
    getActiveStorefrontSlugs(),
  ])

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/search`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/pricing`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/legal`, changeFrequency: 'monthly', priority: 0.2 },
  ]

  return [
    ...staticPages,
    ...parents.map((slug) => ({
      url: `${BASE}/categories/${slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...storefronts.map((slug) => ({
      url: `${BASE}/professionals/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
