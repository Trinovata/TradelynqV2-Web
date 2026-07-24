import Link from 'next/link'
import { TIERS, type TierId } from '@/lib/constants/pricing'

/**
 * The mobile workspace header (playbook S105).
 *
 * The desktop sidebar carries the wordmark and tier; on a phone there is no
 * sidebar, so this slim sticky bar keeps the professional oriented — brand on
 * the left, a tap-through tier chip on the right. Desktop hides it (`lg:hidden`)
 * because the rail already says all of this.
 */
export function WorkspaceTopBar({ tier }: { tier: TierId | null }) {
  const tierName = tier ? TIERS[tier].name : 'No plan'

  return (
    <header className="border-border bg-card/85 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur-md lg:hidden">
      <Link href="/dashboard" className="text-foreground text-base font-semibold tracking-tight">
        Trade<span className="text-brand-cyan">Lynq</span>
      </Link>
      <Link
        href="/subscription"
        className="border-border text-body rounded-full border px-3 py-1 text-xs font-medium"
      >
        {tierName}
      </Link>
    </header>
  )
}
