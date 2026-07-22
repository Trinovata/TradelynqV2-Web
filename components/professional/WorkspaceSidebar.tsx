'use client'

/**
 * The professional workspace sidebar (playbook S105, spec v2/05 §5.0).
 *
 * The framework every business tool hangs off. Its six sections come from the
 * shared nav map (`./nav`), so the desktop rail and the mobile bar never drift.
 * Items a plan does not include still render — so the professional sees what an
 * upgrade unlocks — but carry a lock glyph and route to the subscription page
 * rather than a dead 403. The always-navy rail (the `--sidebar` token) keeps the
 * workspace visually distinct from the public site; its foot carries the two
 * things a professional checks constantly (tier + credit balance) plus a direct
 * line to support on WhatsApp.
 *
 * Nav state is derived from the path, so the active item stays correct after any
 * client navigation and there is no state to keep in sync.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TIERS, tierHasFeature, type TierId } from '@/lib/constants/pricing'
import { NAV_SECTIONS, SUPPORT_WHATSAPP, type NavItem } from './nav'

/** True when an item is gated and the current tier does not grant its feature. */
function isLocked(item: NavItem, tier: TierId | null): boolean {
  if (!item.requires) return false
  return !(tier && tierHasFeature(tier, item.requires))
}

export function WorkspaceSidebar({ tier }: { tier: TierId | null }) {
  const pathname = usePathname()
  const tierName = tier ? TIERS[tier].name : 'No plan'

  return (
    <aside className="bg-sidebar hidden w-[280px] shrink-0 flex-col lg:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-white/90">
          Trade<span className="text-brand-cyan">Lynq</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading} className="mb-5">
            <p className="px-3 pb-1.5 text-[11px] font-medium tracking-[0.12em] text-white/35 uppercase">
              {section.heading}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const locked = isLocked(item, tier)
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                // A locked tool routes to the upgrade path, not a dead 403.
                const href = locked ? '/subscription' : item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex items-center gap-3 rounded-[--radius-control] px-3 py-2 text-sm transition-[background-color,color] duration-150',
                        active
                          ? 'bg-sidebar-active font-medium text-white'
                          : 'hover:bg-sidebar-hover text-white/65 hover:text-white/90'
                      )}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden="true" />
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
      </nav>

      {/* Foot: the two things a professional checks constantly + support. */}
      <div className="border-t border-white/10 p-3">
        <Link
          href="/subscription"
          className="hover:bg-sidebar-hover flex items-center justify-between rounded-[--radius-control] px-3 py-2 text-sm transition-[background-color] duration-150"
        >
          <span className="text-white/60">Plan</span>
          <span className="font-medium text-white/90">{tierName}</span>
        </Link>
        <Link
          href="/credits"
          className="hover:bg-sidebar-hover flex items-center justify-between rounded-[--radius-control] px-3 py-2 text-sm transition-[background-color] duration-150"
        >
          <span className="text-white/60">Credits</span>
          <span className="font-mono font-medium text-white/90 tabular-nums">—</span>
        </Link>
        <a
          href={SUPPORT_WHATSAPP}
          target="_blank"
          rel="noreferrer"
          className="mt-1 flex items-center gap-2 rounded-[--radius-control] px-3 py-2 text-sm text-white/55 transition-[color] duration-150 hover:text-white/85"
        >
          <MessageCircle className="text-whatsapp size-4" aria-hidden="true" />
          Support on WhatsApp
        </a>
      </div>
    </aside>
  )
}
