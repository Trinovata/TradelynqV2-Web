import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  requireRole,
  missingLegalAcceptances,
  PROFESSIONAL_ONBOARDING_LEGAL,
} from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { getOnboardingContext } from '@/lib/professional/onboarding-server'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export const metadata: Metadata = {
  title: 'Set up your storefront',
  // Nobody should reach a half-built storefront from a search result.
  robots: { index: false, follow: false },
}

/**
 * `/onboarding` (playbook S107, spec `v2/05 §5.2`).
 *
 * Always dynamic: this renders one professional's own draft, so a cached copy
 * would be someone else's storefront.
 */
export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const access = await requireRole(['professional'])
  // A customer or a signed-out visitor has no business here. Login routes an
  // authenticated customer on to /home rather than looping them back.
  if (!access.ok) redirect(loginRedirect('/onboarding'))

  const context = await getOnboardingContext(access.supabase, access.userId)

  // Already submitted or live: onboarding is over. The workspace is where a
  // storefront is edited from that point on, and re-entering the wizard would
  // offer a second write path into a published listing.
  if (context.listingStatus && context.listingStatus !== 'draft') {
    redirect('/dashboard')
  }

  const legal = await missingLegalAcceptances(access, PROFESSIONAL_ONBOARDING_LEGAL)

  return (
    <OnboardingWizard
      context={context}
      subtype={access.subtype}
      // Fails closed: if the acceptances table could not be read, show the gate
      // rather than assume nothing is outstanding.
      missingLegal={'missing' in legal ? legal.missing : [...PROFESSIONAL_ONBOARDING_LEGAL]}
      userId={access.userId}
    />
  )
}
