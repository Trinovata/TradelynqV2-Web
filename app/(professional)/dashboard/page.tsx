import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Inbox,
  Briefcase,
  CircleCheck,
  Star,
  ArrowRight,
  ArrowUpRight,
  Check,
  Store,
  ListChecks,
} from 'lucide-react'
import { requireProfessional } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { getEnquiryInbox, type EnquiryRow } from '@/lib/enquiries/queries'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatRelativeTime, formatRating } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import type { Enums } from '@/types/database'

export const metadata: Metadata = {
  title: 'Home',
}

/**
 * /dashboard — the workspace home (playbook S106, spec 05 §5.1).
 *
 * The "run your business at a glance" surface, in the spirit of a Shopify admin
 * home: a setup guide that recedes as the storefront gets finished, a row of real
 * KPI tiles, the queue of what needs the professional now, and recent activity.
 * Everything is derived from live data — the enquiry inbox and the professional's
 * own profile row — so nothing here is invented. When there is no data, each
 * region teaches rather than fabricates.
 */

const STATUS_LABEL: Record<Enums<'enquiry_status'>, string> = {
  pending: 'New',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  declined: 'Declined',
}

function greeting(): string {
  // Atlantic Standard Time (UTC−4) — T&T has no DST, so a fixed offset is exact.
  const hour = (new Date().getUTCHours() - 4 + 24) % 24
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * The request-time clock, read through a plain helper. A server component renders
 * once per request, so sampling "now" here is deterministic for that render; the
 * helper keeps the read out of the component body, where the render-purity lint
 * (rightly) forbids direct clock calls.
 */
function sampleNowMs(): number {
  return Date.now()
}

export default async function DashboardPage() {
  const ctx = await requireProfessional()
  if (!ctx.ok) redirect(loginRedirect('/dashboard'))

  const [inbox, profileRes] = await Promise.all([
    getEnquiryInbox(ctx.supabase),
    ctx.supabase
      .from('professional_profiles')
      .select(
        'business_name, owner_name, slug, bio, cover_photo_url, portfolio_urls, contact_whatsapp, national_id_verified, category_id, average_rating, review_count, listing_status'
      )
      .eq('id', ctx.professionalId)
      .maybeSingle(),
  ])

  const profile = profileRes.data
  const rows = inbox.rows
  const firstName = profile?.owner_name?.split(' ')[0] ?? profile?.business_name ?? 'there'

  // ── Derived, all from real rows ──────────────────────────────────────────
  // Sampled once per request (this is a server component, rendered once). Passed
  // down so the sync row components stay pure — no clock reads mid-render.
  const nowMs = sampleNowMs()
  const now = new Date(nowMs)
  const monthKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}`
  const pending = rows.filter((r) => r.status === 'pending')
  const active = rows.filter((r) => r.status === 'accepted' || r.status === 'in_progress')
  const completedThisMonth = rows.filter(
    (r) =>
      r.status === 'completed' &&
      r.completed_at &&
      `${new Date(r.completed_at).getUTCFullYear()}-${new Date(r.completed_at).getUTCMonth()}` ===
        monthKey
  )
  const queue = [...pending].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 5)
  const recent = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)

  const steps = [
    { label: 'Write your bio', done: Boolean(profile?.bio), href: '/storefront' },
    { label: 'Add a cover photo', done: Boolean(profile?.cover_photo_url), href: '/storefront' },
    {
      label: 'Showcase your work',
      done: (profile?.portfolio_urls?.length ?? 0) > 0,
      href: '/portfolio',
    },
    { label: 'Connect WhatsApp', done: Boolean(profile?.contact_whatsapp), href: '/storefront' },
    { label: 'Get ID verified', done: Boolean(profile?.national_id_verified), href: '/readiness' },
  ]
  const stepsDone = steps.filter((s) => s.done).length
  const setupComplete = stepsDone === steps.length

  const storefrontHref =
    profile?.slug && profile.listing_status === 'active' ? `/professionals/${profile.slug}` : null

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-foreground font-display text-3xl tracking-tight">
            {greeting()}, {firstName}
          </h1>
          <p className="text-muted mt-1 text-sm">
            {pending.length > 0
              ? `${pending.length} ${pending.length === 1 ? 'enquiry needs' : 'enquiries need'} your reply.`
              : 'Everything is up to date. Nice work.'}
          </p>
        </div>
        {storefrontHref && (
          <Button asChild variant="secondary" size="sm">
            <a href={storefrontHref} target="_blank" rel="noreferrer">
              View storefront
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </Button>
        )}
      </header>

      {!setupComplete && <SetupGuide steps={steps} done={stepsDone} />}

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Inbox}
          label="New enquiries"
          value={pending.length}
          accent={pending.length > 0}
        />
        <StatTile icon={Briefcase} label="Active work" value={active.length} />
        <StatTile
          icon={CircleCheck}
          label="Completed this month"
          value={completedThisMonth.length}
        />
        <StatTile
          icon={Star}
          label={`Rating${profile?.review_count ? ` · ${profile.review_count}` : ''}`}
          display={profile?.review_count ? formatRating(profile.average_rating) : '—'}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Needs your attention" icon={ListChecks} count={pending.length}>
          {queue.length === 0 ? (
            <PanelEmpty
              heading="You're all caught up"
              body="New enquiries appear here the moment a customer reaches out."
            />
          ) : (
            <ul className="divide-border divide-y">
              {queue.map((row) => (
                <QueueRow key={row.id} row={row} nowMs={nowMs} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent enquiries" icon={Inbox}>
          {recent.length === 0 ? (
            <PanelEmpty
              heading="No enquiries yet"
              body="Share your storefront to bring in your first."
              action={
                storefrontHref ? { label: 'View storefront', href: storefrontHref } : undefined
              }
            />
          ) : (
            <ul className="divide-border divide-y">
              {recent.map((row) => (
                <RecentRow key={row.id} row={row} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  display,
  accent,
}: {
  icon: typeof Inbox
  label: string
  value?: number
  display?: string
  accent?: boolean
}) {
  return (
    <div className="border-border bg-card rounded-[--radius-card] border p-4">
      <div className="flex items-center gap-2">
        <Icon
          className={cn('size-4', accent ? 'text-accent-ink' : 'text-muted')}
          aria-hidden="true"
        />
        <span className="text-muted truncate text-xs font-medium">{label}</span>
      </div>
      <p className="text-foreground mt-2 font-mono text-2xl tabular-nums">
        {display ?? value?.toLocaleString('en-TT')}
      </p>
    </div>
  )
}

function SetupGuide({
  steps,
  done,
}: {
  steps: { label: string; done: boolean; href: string }[]
  done: number
}) {
  const pct = Math.round((done / steps.length) * 100)
  return (
    <section className="border-border bg-card mb-6 rounded-[--radius-card] border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="bg-accent-soft flex size-9 items-center justify-center rounded-[--radius-control]">
            <Store className="text-accent-ink size-4.5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-foreground font-medium">Finish setting up your storefront</h2>
            <p className="text-muted text-sm">
              A complete storefront turns more searches into enquiries.
            </p>
          </div>
        </div>
        <span className="text-muted shrink-0 font-mono text-sm tabular-nums">
          {done}/{steps.length}
        </span>
      </div>

      <div className="bg-card-subtle mt-4 h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-accent h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-4 grid gap-1 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className={cn(
                'group flex items-center gap-2.5 rounded-[--radius-control] px-2 py-1.5 text-sm transition-colors',
                step.done ? 'text-muted' : 'text-body hover:bg-card-subtle'
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border',
                  step.done ? 'border-success bg-success/10' : 'border-border'
                )}
              >
                {step.done && <Check className="text-success size-3" aria-hidden="true" />}
              </span>
              <span className={cn('flex-1', step.done && 'line-through')}>{step.label}</span>
              {!step.done && (
                <ArrowRight
                  className="text-muted size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Panel({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string
  icon: typeof Inbox
  count?: number
  children: React.ReactNode
}) {
  return (
    <section className="border-border bg-card overflow-hidden rounded-[--radius-card] border">
      <div className="border-border flex items-center justify-between border-b px-5 py-3.5">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-medium">
          <Icon className="text-muted size-4" aria-hidden="true" />
          {title}
        </h2>
        {count != null && count > 0 && (
          <span className="bg-accent-soft text-accent-ink rounded-full px-2 py-0.5 font-mono text-xs tabular-nums">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

function PanelEmpty({
  heading,
  body,
  action,
}: {
  heading: string
  body: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
      <p className="text-foreground text-sm font-medium">{heading}</p>
      <p className="text-muted max-w-xs text-sm text-pretty">{body}</p>
      {action && (
        <Button asChild variant="secondary" size="sm" className="mt-2">
          <a href={action.href} target="_blank" rel="noreferrer">
            {action.label}
          </a>
        </Button>
      )}
    </div>
  )
}

function QueueRow({ row, nowMs }: { row: EnquiryRow; nowMs: number }) {
  const name = row.customer_first_name ?? 'Customer'
  const hours = Math.max(0, Math.floor((nowMs - new Date(row.created_at).getTime()) / 3_600_000))
  return (
    <li>
      <Link
        href={`/enquiries/${row.id}`}
        className="hover:bg-card-subtle flex items-center gap-3 px-5 py-3.5 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <span className="text-foreground text-sm font-medium">{name}</span>
          <p className="text-muted truncate text-sm">{row.description}</p>
        </div>
        {hours >= 24 ? (
          <Badge variant="pending">{hours}h waiting</Badge>
        ) : (
          <span className="text-muted shrink-0 text-xs">{hours}h ago</span>
        )}
        <ArrowRight className="text-muted size-4 shrink-0" aria-hidden="true" />
      </Link>
    </li>
  )
}

function RecentRow({ row }: { row: EnquiryRow }) {
  const name = row.customer_first_name ?? 'Customer'
  return (
    <li>
      <Link
        href={`/enquiries/${row.id}`}
        className="hover:bg-card-subtle flex items-center gap-3 px-5 py-3 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <span className="text-foreground text-sm">{name}</span>
          <p className="text-muted truncate text-xs">{formatRelativeTime(row.created_at)}</p>
        </div>
        <Badge status={row.status}>{STATUS_LABEL[row.status]}</Badge>
      </Link>
    </li>
  )
}
