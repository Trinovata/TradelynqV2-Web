import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireCustomer, CURRENT_LEGAL_VERSIONS, type LegalDocument } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { SignOutButton } from './SignOutButton'

export const metadata: Metadata = { title: 'Settings' }

const LEGAL_LABEL: Record<LegalDocument, { label: string; href: string }> = {
  privacy: { label: 'Privacy policy', href: '/legal/privacy' },
  terms: { label: 'Terms of service', href: '/legal/terms' },
  eula: { label: 'User agreement', href: '/legal/eula' },
  reviews: { label: 'Reviews policy', href: '/legal/reviews' },
}

/**
 * Customer settings (playbook S103, spec 04 §4.6). Flat cards: profile
 * summary, appearance (theme), legal (accepted docs + versions), account
 * (sign out; delete via support until DSAR automation ships — stated
 * honestly). The role-grace card belongs to professionals switching in; a
 * customer past their grace window sees no switcher, so it is omitted here
 * until the grace surface lands with the shared account settings (S115).
 */
export default async function CustomerSettingsPage() {
  const access = await requireCustomer()
  if (!access.ok) redirect(loginRedirect('/home/settings'))

  const [{ data: profile }, { data: acceptances }] = await Promise.all([
    access.supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', access.userId)
      .maybeSingle(),
    access.supabase
      .from('legal_acceptances')
      .select('document_type, document_version')
      .eq('user_id', access.userId),
  ])

  const acceptedVersion = new Map(
    (acceptances ?? []).map((a) => [a.document_type, a.document_version])
  )

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-foreground font-display text-2xl tracking-tight">Settings</h1>

      <section className="border-border bg-card mt-6 rounded-[--radius-card] border p-5">
        <h2 className="text-foreground text-sm font-medium">Profile</h2>
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Name</dt>
            <dd className="text-body">{profile?.full_name ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Email</dt>
            <dd className="text-body font-mono text-xs">{profile?.email ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="border-border bg-card mt-4 rounded-[--radius-card] border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-foreground text-sm font-medium">Appearance</h2>
            <p className="text-muted mt-0.5 text-xs">System, light, or dark.</p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <section className="border-border bg-card mt-4 rounded-[--radius-card] border p-5">
        <h2 className="text-foreground text-sm font-medium">Legal</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {(Object.keys(LEGAL_LABEL) as LegalDocument[]).map((doc) => {
            const accepted = acceptedVersion.get(doc)
            const current = CURRENT_LEGAL_VERSIONS[doc]
            return (
              <li key={doc} className="flex items-center justify-between gap-4">
                <Link
                  href={LEGAL_LABEL[doc].href}
                  className="text-body underline underline-offset-4"
                >
                  {LEGAL_LABEL[doc].label}
                </Link>
                <span className="text-muted font-mono text-xs tabular-nums">
                  {accepted ? `accepted v${accepted}` : 'not accepted'}
                  {accepted && accepted !== current ? ` · v${current} available` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="border-border bg-card mt-4 rounded-[--radius-card] border p-5">
        <h2 className="text-foreground text-sm font-medium">Account</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <SignOutButton />
          <Link
            href="/support"
            className="text-body hover:text-foreground text-sm underline underline-offset-4 transition-colors"
          >
            Delete my account
          </Link>
        </div>
        <p className="text-muted mt-2 text-xs">
          Account deletion is handled by our team while we finish self-service tools — message us
          and we&rsquo;ll remove your data.
        </p>
      </section>
    </div>
  )
}
