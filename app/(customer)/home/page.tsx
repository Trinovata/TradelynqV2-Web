import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search, MessageCircle, Bookmark, ShieldCheck } from 'lucide-react'
import { requireCustomer } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { getCustomerEnquiries } from '@/lib/enquiries/queries'
import { getSavedProfessionalIds } from '@/lib/marketplace/saved'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export const metadata: Metadata = {
  title: 'Home',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting reply',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Completed',
}

/**
 * /home — the customer's landing after signing in (playbook S097, spec v2/04).
 *
 * Leads with search (the customer's core job) but is now live: an
 * attention band surfaces enquiries that need the customer (a reply to read,
 * a completed job to review), then their active enquiries and saved count.
 * Everything shown is a real row — no fabricated activity, and no ads ever
 * on a customer surface (D11).
 */
export default async function CustomerHomePage() {
  const ctx = await requireCustomer()
  if (!ctx.ok) redirect(loginRedirect('/home'))

  const [{ data: profile }, { rows: enquiries }, savedIds] = await Promise.all([
    ctx.supabase.from('profiles').select('full_name').eq('id', ctx.userId).maybeSingle(),
    getCustomerEnquiries(ctx.supabase),
    getSavedProfessionalIds(),
  ])
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  // Needs-attention: a completed job with no review, or a freshly accepted
  // enquiry. Active: anything still in motion. Both are real rows.
  const active = enquiries.filter((e) => ['pending', 'accepted', 'in_progress'].includes(e.status))
  const toReview = enquiries.filter((e) => e.status === 'completed')
  const savedCount = savedIds.size

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

      {toReview.length > 0 && (
        <section className="border-success/30 bg-success/5 mt-6 rounded-[--radius-card] border p-5">
          <h2 className="text-foreground text-sm font-medium">
            {toReview.length === 1
              ? 'A completed job is waiting for your review'
              : `${toReview.length} completed jobs are waiting for your review`}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {toReview.slice(0, 3).map((e) => (
              <li key={e.id}>
                <Link
                  href={`/home/enquiries/${e.id}/review`}
                  className="text-foreground text-sm underline underline-offset-4"
                >
                  Review {e.professional?.business_name ?? 'the professional'}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {active.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-foreground font-medium">Active enquiries</h2>
            <Link
              href="/home/enquiries"
              className="text-body hover:text-foreground text-sm transition-colors"
            >
              View all
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {active.slice(0, 4).map((e) => (
              <li key={e.id}>
                <Link
                  href={`/home/enquiries/${e.id}`}
                  className="border-border bg-card hover:border-accent/30 flex items-center justify-between gap-3 rounded-[--radius-card] border p-4 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">
                      {e.professional?.business_name ?? 'A professional'}
                    </p>
                    <p className="text-muted mt-0.5 line-clamp-1 text-xs">{e.description}</p>
                  </div>
                  <Badge status={e.status}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <SignpostCard
          icon={MessageCircle}
          title="Your enquiries"
          body={
            active.length > 0
              ? `${active.length} active · see replies and track progress.`
              : "Track the professionals you've reached and see their replies."
          }
          href="/home/enquiries"
        />
        <SignpostCard
          icon={Bookmark}
          title="Saved professionals"
          body={
            savedCount > 0
              ? `${savedCount} saved · compare them and come back later.`
              : 'Save professionals as you browse to compare them and come back later.'
          }
          href="/saved"
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
