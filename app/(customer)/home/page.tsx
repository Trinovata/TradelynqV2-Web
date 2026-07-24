import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search, MessageCircle, Bookmark, ShieldCheck } from 'lucide-react'
import { requireCustomer } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { Button } from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'Home',
}

/**
 * /home — the customer's landing after signing in (playbook S097, spec v2/04).
 *
 * The customer's job is to find and reach the right professional, so the home
 * leads with search rather than a data dashboard. The enquiry and saved surfaces
 * arrive with the rest of Phase 5; until then their cards are honest sign-posts,
 * not fabricated activity. Never any ads on a customer surface (D11).
 */
export default async function CustomerHomePage() {
  const ctx = await requireCustomer()
  if (!ctx.ok) redirect(loginRedirect('/home'))

  const { data } = await ctx.supabase
    .from('profiles')
    .select('full_name')
    .eq('id', ctx.userId)
    .maybeSingle()
  const firstName = data?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <h1 className="text-foreground font-display text-3xl tracking-tight">
          Welcome, {firstName}
        </h1>
        <p className="text-muted mt-2 max-w-prose text-sm">
          Describe what you need done and reach verified professionals across Trinidad &amp; Tobago
          — free, straight on WhatsApp.
        </p>
      </header>

      <section className="border-border bg-card rounded-[--radius-card] border p-6 sm:p-8">
        <div className="flex flex-col items-start gap-4">
          <span className="bg-accent-soft flex size-11 items-center justify-center rounded-[--radius-control]">
            <Search className="text-accent-ink size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-foreground text-lg font-medium">Find someone for the job</h2>
            <p className="text-muted mt-1 max-w-md text-sm">
              Plumbing, beauty, tutoring, repairs — search by what you need and compare
              professionals by their reviews.
            </p>
          </div>
          <Button asChild>
            <Link href="/search">Start a search</Link>
          </Button>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <SignpostCard
          icon={MessageCircle}
          title="Your enquiries"
          body="Track the professionals you've reached and see their replies."
          href="/home/enquiries"
        />
        <SignpostCard
          icon={Bookmark}
          title="Saved professionals"
          body="Save professionals as you browse to compare them and come back later."
        />
      </section>

      <p className="text-muted mt-8 flex items-center gap-2 text-xs">
        <ShieldCheck className="text-success size-4" aria-hidden="true" />
        Every professional is identity-checked and every review is moderated.
      </p>
    </div>
  )
}

function SignpostCard({
  icon: Icon,
  title,
  body,
  href,
}: {
  icon: typeof Search
  title: string
  body: string
  href?: string
}) {
  const inner = (
    <>
      <Icon className="text-muted size-5" aria-hidden="true" />
      <h3 className="text-foreground mt-3 font-medium">{title}</h3>
      <p className="text-muted mt-1 text-sm text-pretty">{body}</p>
    </>
  )
  const className = 'border-border bg-card block rounded-[--radius-card] border p-5'
  return href ? (
    <Link href={href} className={`${className} hover:border-accent/30 transition-colors`}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  )
}
