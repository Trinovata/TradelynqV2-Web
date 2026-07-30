import Link from 'next/link'
import { TIERS, type TierId } from '@/lib/constants/pricing'
import { Avatar } from '@/components/ui/Avatar'
import type { WorkspaceInfo } from './WorkspaceSidebar'

/**
 * The mobile workspace header (playbook S105).
 *
 * The desktop rail carries the identity; on a phone there is no rail, so this
 * slim sticky bar leads with the same identity (avatar + business name) and a
 * tap-through plan chip. Desktop hides it (`lg:hidden`).
 */
export function WorkspaceTopBar({
  tier,
  workspace,
}: {
  tier: TierId | null
  workspace: WorkspaceInfo
}) {
  const tierName = tier ? TIERS[tier].name : 'No plan'

  return (
    <header className="border-border bg-card/85 sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b px-4 backdrop-blur-md lg:hidden">
      <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
        <Avatar
          src={workspace.avatarUrl}
          alt={workspace.businessName}
          name={workspace.businessName}
          size={32}
        />
        <span className="text-foreground truncate text-sm font-semibold tracking-tight">
          {workspace.businessName}
        </span>
      </Link>
      <Link
        href="/subscription"
        className="border-border text-body shrink-0 rounded-full border px-3 py-1 text-xs font-medium"
      >
        {tierName}
      </Link>
    </header>
  )
}
