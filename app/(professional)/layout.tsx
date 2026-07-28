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

  // The shell leads with the professional's own identity — whose workspace this
  // is — the way a premium SaaS tool does, plus the live credit balance the
  // footer shows. One query at the frame; the tools stay pure content.
  const [{ data: profile }, { data: credits }] = await Promise.all([
    ctx.supabase
      .from('professional_profiles')
      .select('business_name, owner_name, profile_photo_url, slug, listing_status')
      .eq('id', ctx.professionalId)
      .maybeSingle(),
    ctx.supabase
      .from('tool_credit_accounts')
      .select('balance')
      .eq('professional_id', ctx.professionalId)
      .maybeSingle(),
  ])

  const workspace = {
    businessName: profile?.business_name ?? 'Your workspace',
    ownerName: profile?.owner_name ?? null,
    avatarUrl: profile?.profile_photo_url ?? null,
    storefrontHref:
      profile?.slug && profile.listing_status === 'active'
        ? `/professionals/${profile.slug}`
        : null,
    credits: credits?.balance ?? null,
  }

  return (
    <div className="bg-background flex min-h-dvh">
      <WorkspaceSidebar tier={ctx.tier} workspace={workspace} />

      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceTopBar tier={ctx.tier} workspace={workspace} />
        {/* Each tool owns its content width + horizontal padding (a list wants
            room, a form wants a narrow measure — premium tools vary by
            context). The shell only reserves bottom room for the mobile tab
            bar. */}
        <main className="flex-1 pb-24 lg:pb-12">{children}</main>
      </div>

      <WorkspaceTabBar tier={ctx.tier} />
      <Toaster />
    </div>
  )
}
