'use client'

/**
 * Desktop customer-portal nav (playbook S096). The same four destinations as
 * the mobile tab bar, inline in the header — shown only at `lg` and up, where
 * the bottom bar is hidden. Active state matches the tab bar exactly.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

const LINKS = [
  { href: '/home', label: 'Home' },
  { href: '/home/enquiries', label: 'Enquiries' },
  { href: '/saved', label: 'Saved' },
  { href: '/home/settings', label: 'Settings' },
] as const

export function CustomerNavLinks() {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === '/home' ? pathname === '/home' : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <nav aria-label="Portal" className="hidden items-center gap-6 lg:flex">
      {LINKS.map((link) => {
        const active = isActive(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'text-sm transition-colors',
              active ? 'text-foreground font-medium' : 'text-body hover:text-foreground'
            )}
          >
            {link.label}
          </Link>
        )
      })}
      <Link href="/search" className="text-body hover:text-foreground text-sm transition-colors">
        Find a professional
      </Link>
    </nav>
  )
}
