import type { Metadata } from 'next'
import Link from 'next/link'
import { Inbox, FileText, Receipt, Store, ArrowRight, ListChecks } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { Button } from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'Today',
}

/**
 * /dashboard — the "Today" surface (playbook S105, spec v2/05 §5.0).
 *
 * The professional's landing inside the workspace: what needs them now, and the
 * quickest way into the work. This is the framework's first tenant — a real page
 * proving the shell, deliberately without invented numbers. The action queue
 * shows its empty state (canon: never fabricate a metric or a lead); the live
 * feed lands when Enquiries does. The layout is asymmetric on purpose — one wide
 * attention column, a narrower rail of ways in — rather than a row of identical
 * stat cards.
 */

const WAYS_IN = [
  { href: '/enquiries', label: 'Enquiries', icon: Inbox, hint: 'New customer messages' },
  { href: '/quotes', label: 'Quotes', icon: FileText, hint: 'Draft and send estimates' },
  { href: '/invoices', label: 'Invoices', icon: Receipt, hint: 'Bill and track payment' },
]

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-8">
        <p className="text-muted text-xs font-medium tracking-[0.14em] uppercase">Today</p>
        <h1 className="text-foreground font-display mt-1 text-3xl tracking-tight">Your workspace</h1>
        <p className="text-muted mt-2 max-w-prose text-sm">
          What needs you now, and the quickest way into the work.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        {/* Attention column — the action queue lands here when Enquiries ships. */}
        <Card padding="none" className="overflow-hidden">
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-foreground font-medium">Needs your attention</h2>
            <ListChecks className="text-muted size-4" aria-hidden="true" />
          </div>
          <EmptyState
            icon={Inbox}
            heading="Nothing waiting on you"
            body="New enquiries, quotes to follow up, and unpaid invoices will surface here as they arrive."
            action={{ label: 'View enquiries', href: '/enquiries' }}
          />
        </Card>

        {/* Rail — ways into the work, and a storefront nudge. */}
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-muted mb-2 px-1 text-xs font-medium tracking-[0.12em] uppercase">
              Jump in
            </h2>
            <div className="flex flex-col gap-2">
              {WAYS_IN.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group border-border bg-card hover:border-accent/30 flex items-center gap-3 rounded-[--radius-card] border px-4 py-3 transition-[border-color] duration-150"
                >
                  <span className="bg-accent-soft flex size-9 shrink-0 items-center justify-center rounded-[--radius-control]">
                    <item.icon className="text-accent-ink size-4.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground block text-sm font-medium">{item.label}</span>
                    <span className="text-muted block text-xs">{item.hint}</span>
                  </span>
                  <ArrowRight
                    className="text-muted size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="flex flex-col items-start gap-3 p-5">
              <span className="bg-accent-soft flex size-9 items-center justify-center rounded-[--radius-control]">
                <Store className="text-accent-ink size-4.5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-foreground font-medium">Complete your storefront</h3>
                <p className="text-muted mt-1 text-sm text-pretty">
                  A finished profile is what turns a search into an enquiry. Add your work, areas,
                  and offerings.
                </p>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link href="/storefront">Edit storefront</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
