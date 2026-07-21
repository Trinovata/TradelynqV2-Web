import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Inbox } from 'lucide-react'
import { requireProfessional } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { getEnquiryInbox, tabForStatus, type EnquiryTab, type EnquiryRow } from '@/lib/enquiries/queries'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/utils/cn'
import { EnquiryRowLink } from './EnquiryRowLink'

export const metadata: Metadata = {
  title: 'Enquiries',
}

const TABS: ReadonlyArray<{ key: EnquiryTab; label: string }> = [
  { key: 'new', label: 'New' },
  { key: 'active', label: 'Active' },
  { key: 'done', label: 'Done' },
]

/** Per-tab empty copy. Headings are from the deck (05 §5.1); bodies support them. */
const EMPTY: Record<EnquiryTab, { heading: string; body: string }> = {
  new: { heading: 'No new enquiries.', body: 'Share your storefront to bring in more work.' },
  active: { heading: 'Nothing in progress.', body: 'Enquiries you accept will show here.' },
  done: { heading: 'No completed enquiries yet.', body: 'Finished work will be kept here.' },
}

function resolveTab(value: string | undefined): EnquiryTab {
  return value === 'active' || value === 'done' ? value : 'new'
}

/**
 * /enquiries — the inbox (spec 05 §5.1).
 *
 * The first tool to render live data through the workspace shell. Tabs are URL
 * state (`?tab=`), so a tab is a shareable, back-buttonable location and the page
 * stays a server component with no client fetch. One inbox call feeds all three
 * tabs; counts and filtering happen in memory.
 */
export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const ctx = await requireProfessional()
  if (!ctx.ok) redirect(loginRedirect('/enquiries'))

  const { rows, error } = await getEnquiryInbox(ctx.supabase)
  const activeTab = resolveTab((await searchParams).tab)

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <h1 className="text-foreground font-display text-3xl tracking-tight">Enquiries</h1>
        <p className="text-muted mt-1 text-sm">Every request from a customer, in one place.</p>
      </header>

      {error ? (
        <ErrorState body="We couldn't load your enquiries just now. Try again in a moment." />
      ) : (
        <EnquiriesContent rows={rows} activeTab={activeTab} />
      )}
    </div>
  )
}

function EnquiriesContent({ rows, activeTab }: { rows: EnquiryRow[]; activeTab: EnquiryTab }) {
  const counts: Record<EnquiryTab, number> = { new: 0, active: 0, done: 0 }
  for (const row of rows) counts[tabForStatus(row.status)] += 1

  const visible = rows.filter((row) => tabForStatus(row.status) === activeTab)
  const empty = EMPTY[activeTab]

  return (
    <>
      <div role="tablist" className="border-border mb-4 flex gap-1 border-b">
        {TABS.map((tab) => {
          const selected = tab.key === activeTab
          return (
            <Link
              key={tab.key}
              href={tab.key === 'new' ? '/enquiries' : `/enquiries?tab=${tab.key}`}
              role="tab"
              aria-selected={selected}
              className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors',
                selected
                  ? 'border-accent text-foreground font-medium'
                  : 'text-muted hover:text-body border-transparent'
              )}
            >
              {tab.label}
              <span className="font-mono text-xs tabular-nums">{counts[tab.key]}</span>
            </Link>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          heading={empty.heading}
          body={empty.body}
          action={activeTab === 'new' ? { label: 'Edit storefront', href: '/storefront' } : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((row) => (
            <li key={row.id}>
              <EnquiryRowLink row={row} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
