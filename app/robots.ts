import type { MetadataRoute } from 'next'

/**
 * robots.txt (playbook S087). Authenticated surfaces are disallowed — they
 * 302 anonymous crawlers anyway, but saying so saves the crawl budget for the
 * marketplace. The lists mirror ROUTE_NAMESPACES (lib/routes.ts) — the route
 * contract is the single source of which prefixes are private. The admin
 * origin gets its own noindex treatment at S118.
 */
import { ROUTE_NAMESPACES } from '@/lib/routes'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tradelynq.tech'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dev/',
          ...ROUTE_NAMESPACES.customer,
          ...ROUTE_NAMESPACES.professional,
          ...ROUTE_NAMESPACES.admin,
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
