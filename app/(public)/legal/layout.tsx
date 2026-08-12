import type { ReactNode } from 'react'
import Link from 'next/link'
import { LegalTableOfContents } from '@/components/shared/LegalTableOfContents'

/**
 * Legal section shell (playbook S092). Policy content is ported verbatim from
 * V1's reviewed documents; the chrome is rebuilt on V2 tokens. The `.legal-prose`
 * wrapper (globals.css) styles the long-form body so each page stays plain
 * semantic HTML — headings, paragraphs, lists — which the table of contents
 * scans for `h3[id]` anchors.
 */

const LEGAL_NAV = [
  { label: 'Privacy Policy', href: '/legal/privacy' },
  { label: 'Terms of Service', href: '/legal/terms' },
  { label: 'User Agreement', href: '/legal/eula' },
  { label: 'Review Policy', href: '/legal/reviews' },
]

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background min-h-[100dvh]">
      <div className="bg-accent text-accent-foreground py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <p className="text-brand-cyan mb-1 text-sm font-semibold tracking-wide uppercase">
            Legal &amp; Policies
          </p>
          <h1 className="font-display text-3xl font-bold">TradeLynq Policies</h1>
          <p className="text-accent-foreground/70 mt-2 text-sm">
            Last reviewed: February 2026 · Governing law: Republic of Trinidad and Tobago
          </p>
        </div>
      </div>

      <div className="border-border bg-card sticky top-0 z-10 border-b">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex gap-1 overflow-x-auto">
            {LEGAL_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted hover:text-accent-ink hover:border-accent border-b-2 border-transparent px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_1fr]">
          <LegalTableOfContents />
          <div className="legal-prose border-border bg-card rounded-[--radius-card] border p-4 sm:p-8 lg:p-12">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
