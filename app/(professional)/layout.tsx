import { redirect } from 'next/navigation'
import { requireProfessional } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { WorkspaceSidebar } from '@/components/professional/WorkspaceSidebar'
import { WorkspaceTabBar } from '@/components/professional/WorkspaceTabBar'
import { WorkspaceTopBar } from '@/components/professional/WorkspaceTopBar'
import { Toaster } from '@/components/ui/Toast'

/**
 * The professional workspace shell (playbook S105, spec v2/05 §5.0).
 *
 * Every business tool — Enquiries, Quotes, Jobs, Invoices, the CRM, the whole
 * Growth and Account surface — renders inside this one layout, so the chrome is
 * defined once and each tool page is just its content. The shell is a navy rail
 * on desktop and a bottom tab bar + more-sheet on mobile; the page scrolls, the
 * navigation does not.
 *
 * Auth is enforced here, at the group boundary, so no tool page has to re-guard.
 * `requireProfessional()` also resolves the caller's tier, which the shell needs
 * to decide which tools show a lock — the tier flows down to both navigations as
 * a plain prop, keeping those components client-side and free of data access.
 *
 * A failure means the visitor is not a professional (anonymous, a customer, or
 * an unfinished onboarding). We bounce to login rather than render a shell they
 * cannot use; login routes an already-authenticated user on to their own home.
 */
export default async function ProfessionalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireProfessional()
  if (!ctx.ok) redirect(loginRedirect('/dashboard'))

  return (
    <div className="bg-background flex min-h-dvh">
      <WorkspaceSidebar tier={ctx.tier} />

      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceTopBar tier={ctx.tier} />
        <main className="flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:pb-10">{children}</main>
      </div>

      <WorkspaceTabBar tier={ctx.tier} />
      <Toaster />
    </div>
  )
}
