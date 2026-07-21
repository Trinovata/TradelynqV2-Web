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

const MENU_LINKS = [
  { href: '/search', label: 'Browse professionals' },
  { href: '/for-professionals', label: 'For professionals' },
  { href: '/pricing', label: 'Pricing' },
] as const

export function Navbar() {
  const [menuOpen, setMenuOpen] = React.useState(false)

  return (
    <header className="border-border bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
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
          {MENU_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-foreground hover:bg-card-subtle rounded-[--radius-control] px-3 py-3 text-base transition-[background-color] duration-150"
            >
              {link.label}
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
