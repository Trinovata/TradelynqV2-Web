import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireCustomer } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { CustomerNavLinks } from '@/components/customer/CustomerNavLinks'
import { CustomerTabBar } from '@/components/customer/CustomerTabBar'

/**
 * The customer portal shell (playbook S096, spec v2/04 §4.0).
 *
 * Gates the whole (customer) group at the boundary — reaching any customer page
 * without a customer session bounces to login, which routes an authenticated
 * user on to their own home. Chrome is deliberately light: a desktop header
 * with the four destinations, and a mobile bottom tab bar (the portal is four
 * places, not a workspace of tools). Extra bottom padding on mobile so the tab
 * bar never covers content.
 */
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCustomer()
  if (!ctx.ok) redirect(loginRedirect('/home'))

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border bg-card/85 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/home" className="text-foreground text-base font-semibold tracking-tight">
            Trade<span className="text-brand-cyan">Lynq</span>
          </Link>
          {/* Desktop: the four destinations inline. Mobile: the bottom tab bar. */}
          <CustomerNavLinks />
          <Link
            href="/search"
            className="text-body hover:text-foreground text-sm transition-colors lg:hidden"
          >
            Find a professional
          </Link>
        </div>
      </header>
      <main className="flex-1 pb-20 lg:pb-0">{children}</main>
      <CustomerTabBar />
    </div>
  )
}
