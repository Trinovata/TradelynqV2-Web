'use client'

/**
 * Customer portal bottom tabs (playbook S096, spec v2/04 §4.0).
 *
 * Phones get a four-slot bottom bar for the customer's whole surface — Home,
 * Enquiries, Saved, Settings. Desktop keeps the top header (the portal is
 * light by design; a customer has four destinations, not a workspace of
 * tools), so this renders only below `lg`. Active state matches the workspace
 * pattern: exact path or a nested child.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageCircle, Bookmark, Settings } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const TABS = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/home/enquiries', label: 'Enquiries', icon: MessageCircle },
  { href: '/saved', label: 'Saved', icon: Bookmark },
  { href: '/home/settings', label: 'Settings', icon: Settings },
] as const

export function CustomerTabBar() {
  const pathname = usePathname()

  // Home must match only itself — /home/enquiries is the Enquiries tab, not Home.
  const isActive = (href: string) =>
    href === '/home' ? pathname === '/home' : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <nav
      aria-label="Portal"
      className="border-border bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const active = isActive(tab.href)
          const Icon = tab.icon
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[11px] transition-colors',
                  active ? 'text-accent-ink' : 'text-muted'
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
