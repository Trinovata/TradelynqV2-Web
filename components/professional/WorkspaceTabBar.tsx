'use client'

/**
 * The mobile workspace navigation (playbook S105, spec v2/05 §5.0).
 *
 * Phones get a five-slot bottom bar — the four `primary` destinations plus a
 * "More" sheet holding every remaining tool, grouped exactly as the desktop
 * sidebar groups them. This is the "adapt, don't amputate" rule: nothing the
 * desktop offers is missing on mobile, it is one tap deeper.
 *
 * The sheet is a plain state-toggled overlay rather than a modal dependency —
 * it closes on backdrop tap, on Escape, and on navigation (the pathname change
 * dismisses it). Locked tools route to the upgrade page and wear the amber lock,
 * consistent with the sidebar.
 */
import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Lock, MessageCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TIERS, tierHasFeature, type TierId } from '@/lib/constants/pricing'
import { NAV_SECTIONS, PRIMARY_ITEMS, SUPPORT_WHATSAPP, type NavItem } from './nav'

function isLocked(item: NavItem, tier: TierId | null): boolean {
  if (!item.requires) return false
  return !(tier && tierHasFeature(tier, item.requires))
}

export function WorkspaceTabBar({ tier }: { tier: TierId | null }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = React.useState(false)
  const tierName = tier ? TIERS[tier].name : 'No plan'

  // Any navigation dismisses the sheet — the new route is what the tap meant.
  // Adjusting during render (React's recommended pattern) rather than in an
  // effect: comparing the tracked path lets the close happen before paint, with
  // no extra commit and no cascading-render lint.
  const [seenPath, setSeenPath] = React.useState(pathname)
  if (pathname !== seenPath) {
    setSeenPath(pathname)
    setMoreOpen(false)
  }

  // Escape closes the sheet; lock body scroll while it is open.
  React.useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [moreOpen])

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="More"
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="tl-backdrop absolute inset-0 bg-black/40"
          />
          <div className="tl-sheet bg-card border-border absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[--radius-card] border-t pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <div className="border-border bg-card sticky top-0 flex items-center justify-between border-b px-5 py-3.5">
              <span className="text-foreground font-medium">More</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="text-muted hover:text-foreground -mr-2 p-1"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="px-3 py-2">
              {NAV_SECTIONS.map((section) => (
                <div key={section.heading} className="mb-3">
                  <p className="text-muted px-3 pb-1 text-[11px] font-medium tracking-[0.12em] uppercase">
                    {section.heading}
                  </p>
                  <ul className="flex flex-col">
                    {section.items.map((item) => {
                      const locked = isLocked(item, tier)
                      const href = locked ? '/subscription' : item.href
                      return (
                        <li key={item.href}>
                          <Link
                            href={href}
                            className={cn(
                              'flex items-center gap-3 rounded-[--radius-control] px-3 py-2.5 text-sm',
                              isActive(item.href)
                                ? 'bg-accent-soft text-accent-ink font-medium'
                                : 'text-body active:bg-accent-soft/60'
                            )}
                          >
                            <item.icon
                              className="text-muted size-4.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="flex-1">{item.label}</span>
                            {locked && (
                              <Lock
                                className="text-brand-amber size-3.5"
                                aria-label="Upgrade to unlock"
                              />
                            )}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}

              <div className="border-border mt-1 border-t px-3 pt-3">
                <div className="text-muted flex items-center justify-between px-0 pb-2 text-sm">
                  <span>Plan</span>
                  <span className="text-foreground font-medium">{tierName}</span>
                </div>
                <a
                  href={SUPPORT_WHATSAPP}
                  target="_blank"
                  rel="noreferrer"
                  className="text-body flex items-center gap-2 py-1 text-sm"
                >
                  <MessageCircle className="text-whatsapp size-4.5" aria-hidden="true" />
                  Support on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Workspace"
        className="border-border bg-card fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {PRIMARY_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-[11px]',
                active ? 'text-accent-ink' : 'text-muted'
              )}
            >
              <item.icon className={cn('size-5', active && 'text-accent-ink')} aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          className="text-muted flex flex-1 flex-col items-center gap-1 py-2 text-[11px]"
        >
          <Menu className="size-5" aria-hidden="true" />
          More
        </button>
      </nav>
    </>
  )
}
