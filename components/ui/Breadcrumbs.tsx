import * as React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Breadcrumbs (playbook S071, contract v2/details §21).
 *
 * A server component on purpose — it has no state, and breadcrumbs ship on
 * storefronts where the JSON-LD below must be in the initial HTML for a crawler
 * to see it.
 *
 * Two details worth stating:
 *
 * 1. **The last item is not a link.** It points at the page you are already on,
 *    so a link there is a no-op that still looks and behaves like navigation.
 *    Marking it `aria-current="page"` tells assistive tech where it is instead.
 *
 * 2. **The JSON-LD is not decoration.** Google renders the breadcrumb trail in
 *    place of the raw URL in search results, which is the difference between a
 *    professional's listing showing "tradelynq.com › Plumbers › Arima" and a
 *    URL slug. It mirrors the visible trail exactly — structured data that
 *    disagrees with the page is a manual-action risk, not a ranking trick.
 */

export type BreadcrumbItem = {
  label: string
  /** Omitted on the current page. The last item's href is ignored regardless. */
  href?: string
}

export type BreadcrumbsProps = {
  items: BreadcrumbItem[]
  /**
   * Absolute origin (e.g. `https://tradelynq.com`) used to build absolute URLs
   * in the structured data. Schema.org `item` values must be absolute; relative
   * paths are silently dropped by crawlers. Omit to skip the JSON-LD entirely,
   * which is the right call for authenticated surfaces that are never indexed.
   */
  baseUrl?: string
  className?: string
}

export function Breadcrumbs({ items, baseUrl, className }: BreadcrumbsProps) {
  if (items.length === 0) return null

  const structuredData = baseUrl
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.label,
          ...(item.href ? { item: `${baseUrl.replace(/\/$/, '')}${item.href}` } : {}),
        })),
      }
    : null

  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm', className)}>
      <ol className="text-muted flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight className="text-muted size-3.5 shrink-0" aria-hidden="true" />
              )}

              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn(isLast && 'text-body')}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    // Padded to a comfortable touch target without inflating the
                    // line — the visual text stays 14px, the hit area does not.
                    'inline-flex min-h-11 items-center rounded-[--radius-tag]',
                    'hover:text-foreground transition-[color] duration-150 hover:underline',
                    'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'
                  )}
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>

      {structuredData && (
        <script
          type="application/ld+json"
          // Not an XSS surface, and not an exception to the rule — this is the
          // documented way to emit JSON-LD, and the payload is JSON, not HTML.
          // An HTML sanitiser is the wrong tool here (it would corrupt valid
          // JSON). The one real escape vector is a label containing the literal
          // "</script>", which would close the tag early and put attacker text
          // into the document. The replace below closes it by escaping every
          // less-than sign to its unicode form, so no tag-closing sequence can
          // survive into the output — and the escaped form is still valid JSON
          // that parses back to the original character, so the structured data
          // is unchanged. Safe even if a caller passes a professional-supplied
          // label straight through.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
          }}
        />
      )}
    </nav>
  )
}
