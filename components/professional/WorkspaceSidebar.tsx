'use client'

/**
 * The professional workspace sidebar (playbook S105, spec v2/05 §5.0).
 *
 * Redesigned to lead with IDENTITY the way a premium SaaS workspace does: the
 * professional's own avatar + business name + plan sit at the top, so the rail
 * reads as "your workspace", not a generic app frame. The navy rail (the
 * `--sidebar` token) keeps the workspace visually distinct from the public
 * site; a refined active state (a soft raised pill, the icon warmed) marks the
 * current tool without the heavy solid fill it had before.
 *
 * Sections come from the shared nav map (`./nav`) so the desktop rail and the
 * mobile bar never drift. A gated tool still renders — the professional sees
 * what an upgrade unlocks — with a lock glyph, routing to the plan page, not a
 * dead 403. The foot carries the two things a professional checks constantly
 * (plan + live credits) and a direct line to support.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock, MessageCircle, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TIERS, tierHasFeature, type TierId } from '@/lib/constants/pricing'
import { Avatar } from '@/components/ui/Avatar'
import { NAV_SECTIONS, SUPPORT_WHATSAPP, type NavItem } from './nav'

export type WorkspaceInfo = {
  businessName: string
  ownerName: string | null
  avatarUrl: string | null
  storefrontHref: string | null
  credits: number | null
}

function isLocked(item: NavItem, tier: TierId | null): boolean {
  if (!item.requires) return false
  return !(tier && tierHasFeature(tier, item.requires))
}

export function WorkspaceSidebar({
  tier,
  workspace,
}: {
  tier: TierId | null
  workspace: WorkspaceInfo
}) {
  const pathname = usePathname()
  const tierName = tier ? TIERS[tier].name : 'No plan'

  return (
    <aside className="bg-sidebar hidden w-[264px] shrink-0 flex-col lg:flex">
      {/* Identity — whose workspace this is. */}
      <div className="p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-[--radius-control] px-2 py-2 transition-colors hover:bg-sidebar-hover"
        >
          <Avatar
            src={workspace.avatarUrl}
            alt={workspace.businessName}
            name={workspace.businessName}
            size={40}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white/95">
              {workspace.businessName}
            </span>
            <span className="text-[11px] font-medium tracking-wide text-white/45">{tierName}</span>
          </span>
        </Link>
      </div>

      <div className="bg-sidebar-divider mx-3 h-px" />

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading} className="mb-5 last:mb-0">
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-white/30 uppercase">
              {section.heading}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const locked = isLocked(item, tier)
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                const href = locked ? '/subscription' : item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-[--radius-control] px-2.5 py-2 text-sm transition-[background-color,color] duration-150',
                        active
                          ? 'bg-sidebar-active font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]'
                          : 'text-white/60 hover:bg-sidebar-hover hover:text-white/90'
                      )}
                    >
                      <item.icon
                        className={cn(
                          'size-4 shrink-0 transition-colors',
                          active ? 'text-brand-cyan' : 'text-white/45 group-hover:text-white/70'
                        )}
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {locked && (
                        <Lock className="size-3.5 text-white/35" aria-label="Upgrade to unlock" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Foot: storefront link + live credits + support. */}
      <div className="border-sidebar-divider border-t p-3">
        {workspace.storefrontHref && (
          <a
            href={workspace.storefrontHref}
            target="_blank"
            rel="noreferrer"
            className="mb-1 flex items-center gap-2 rounded-[--radius-control] px-2.5 py-2 text-sm text-white/55 transition-colors hover:bg-sidebar-hover hover:text-white/85"
          >
            <ExternalLink className="size-4 text-white/45" aria-hidden="true" />
            View storefront
          </a>
        )}
        <Link
          href="/credits"
          className="flex items-center justify-between rounded-[--radius-control] px-2.5 py-2 text-sm transition-colors hover:bg-sidebar-hover"
        >
          <span className="text-white/55">Credits</span>
          <span className="font-mono text-sm font-medium text-white/90 tabular-nums">
            {workspace.credits ?? '—'}
          </span>
        </Link>
        <a
          href={SUPPORT_WHATSAPP}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-[--radius-control] px-2.5 py-2 text-sm text-white/55 transition-colors hover:bg-sidebar-hover hover:text-white/85"
        >
          <MessageCircle className="text-whatsapp size-4" aria-hidden="true" />
          Support
        </a>
      </div>
    </aside>
  )
}
