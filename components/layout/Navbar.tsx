'use client'

/**
 * Public site navigation (playbook S076, spec v2/03 §3.1, Thumbtack audit).
 *
 * Structured to the audit's directive: the search is the star of the header and
 * sticky from the first frame, actions are minimal so the CTA hierarchy stays
 * legible, and the one accent colour is reserved for the primary action. Primary
 * exploration happens through the search itself; secondary links live in the
 * footer and the mobile sheet, keeping the top bar quiet.
 */
import * as React from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { NavSearch } from '@/components/layout/NavSearch'

/**
 * Question-led menu (Gregg directive 25 Jul 2026): the drawer is a set of the
 * questions a visitor actually arrives with, each answered by its dedicated
 * page — navigation as answers, not a sitemap.
 */
const MENU_QUESTIONS = [
  { href: '/search', question: 'I need something done', page: 'Find a professional' },
  { href: '/customer-guide', question: 'How does hiring here work?', page: 'Customer guide' },
  { href: '/for-professionals', question: 'How do I grow my business?', page: 'For professionals' },
  { href: '/pricing', question: 'What does it cost?', page: 'Pricing' },
  { href: '/trust', question: 'Can I trust who I find?', page: 'Trust & safety' },
  { href: '/why-tradelynq', question: 'Why does TradeLynq exist?', page: 'The deeper dive' },
  { href: '/about', question: 'Who is behind this?', page: 'About us' },
  { href: '/faq', question: 'Something else?', page: 'Help centre & FAQ' },
] as const

export function Navbar() {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const headerRef = React.useRef<HTMLElement>(null)

  // Scroll-aware chrome: quiet and borderless at the very top of the page,
  // gaining its hairline + soft shadow only once content actually scrolls
  // beneath it. Driven through the ref (a data attribute read by CSS), not
  // React state — zero re-renders per scroll frame.
  React.useEffect(() => {
    const node = headerRef.current
    if (!node) return
    const onScroll = () => {
      node.dataset.scrolled = window.scrollY > 8 ? 'true' : 'false'
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      ref={headerRef}
      className="bg-background/90 data-[scrolled=true]:border-border sticky top-0 z-40 border-b border-transparent backdrop-blur transition-[border-color,box-shadow] duration-300 data-[scrolled=true]:shadow-[0_1px_12px_-8px_rgb(16_22_31/0.18)]"
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:gap-4 sm:px-6"
      >
        <Link href="/" className="shrink-0" aria-label="TradeLynq home">
          <span className="text-foreground text-lg font-semibold tracking-tight">
            Trade<span className="text-accent-ink">Lynq</span>
          </span>
        </Link>

        {/* The star of the header — grows to fill, sticky by virtue of the header. */}
        <NavSearch className="mx-auto hidden max-w-md flex-1 sm:flex" />

        <div className="ml-auto flex items-center gap-1 sm:ml-0 sm:gap-2">
          <Link
            href="/pricing"
            className="text-body hover:text-foreground hidden px-2 text-sm transition-[color] duration-150 lg:block"
          >
            Pricing
          </Link>
          <ThemeToggle />

          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="text-body hover:bg-card-subtle flex size-10 items-center justify-center rounded-[--radius-control] transition-[background-color] duration-150 md:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </div>
      </nav>

      {/* Search stays reachable on the smallest screens too, under the bar. */}
      <div className="border-border/60 border-t px-4 py-2 sm:hidden">
        <NavSearch />
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="Menu" hideTitle>
        <div className="flex flex-col gap-1 pb-4">
          {MENU_QUESTIONS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="hover:bg-card-subtle flex flex-col rounded-[--radius-control] px-3 py-2.5 transition-[background-color] duration-150"
            >
              <span className="text-foreground text-base">{link.question}</span>
              <span className="text-muted text-xs">{link.page}</span>
            </Link>
          ))}
          <div className="border-border mt-2 flex flex-col gap-2 border-t pt-4">
            <Button asChild variant="secondary" fullWidth onClick={() => setMenuOpen(false)}>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild fullWidth onClick={() => setMenuOpen(false)}>
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </Sheet>
    </header>
  )
}
