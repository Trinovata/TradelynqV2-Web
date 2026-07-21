'use client'

/**
 * Fixed bottom navigation for the public site on phones (spec v2/03 §3.1).
 *
 * Shown below 768px only. Keeps the two things a visitor most often wants — find
 * someone, or sign in — one thumb-tap away, with safe-area padding for notched
 * devices. The active tab is derived from the current path.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const TABS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search', label: 'Browse', icon: Search },
  { href: '/login', label: 'Sign in', icon: LogIn },
] as const

export function MobileNavBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary mobile"
      className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {TABS.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
          const Icon = tab.icon
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 text-xs transition-[color] duration-150',
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
