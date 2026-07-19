'use client'

import * as React from 'react'
import { Search, Inbox, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, STATUS_VARIANT, type StatusKey } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { Skeleton, ProfessionalCardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { useTheme, type ThemePreference } from '@/components/layout/ThemeProvider'
import { formatTTD, formatRating, formatReviewCount, formatDate } from '@/lib/utils/format'
import { TIERS, TIER_ORDER, monthlyTotal } from '@/lib/constants/pricing'

/**
 * /dev/kit — the component gallery (playbook S073).
 *
 * Renders every primitive in every state so the system can be reviewed as a
 * whole rather than discovered page by page. Two jobs:
 *
 *   1. It is the acceptance surface for the design system (v2/02 §2.7): if a
 *      primitive is missing a state here, it is missing that state everywhere.
 *   2. It is how the 28 July R2 decision gets made — toggle the theme and the
 *      whole system is visible at once, in both.
 *
 * Staging and local only. Excluded from production by the middleware guard.
 */

function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-border flex flex-col gap-4 border-t py-10 first:border-t-0">
      <div>
        <h2 className="text-display-sm text-foreground">{title}</h2>
        {note && <p className="text-muted mt-1 max-w-2xl text-sm">{note}</p>}
      </div>
      {children}
    </section>
  )
}

function ThemeSwitch() {
  const { preference, resolved, setPreference } = useTheme()
  const options: ThemePreference[] = ['system', 'light', 'dark']

  return (
    <div className="flex items-center gap-3">
      <div
        role="radiogroup"
        aria-label="Theme"
        className="border-border inline-flex rounded-[--radius-control] border p-0.5"
      >
        {options.map((option) => (
          <button
            key={option}
            role="radio"
            aria-checked={preference === option}
            onClick={() => setPreference(option)}
            className={
              preference === option
                ? 'bg-accent text-accent-foreground rounded-[6px] px-3 py-1 text-sm capitalize'
                : 'text-muted hover:text-body rounded-[6px] px-3 py-1 text-sm capitalize'
            }
          >
            {option}
          </button>
        ))}
      </div>
      <span className="text-muted font-mono text-xs tabular-nums">rendering: {resolved}</span>
    </div>
  )
}

export default function DevKitPage() {
  const [loading, setLoading] = React.useState(false)

  const statuses = Object.keys(STATUS_VARIANT) as StatusKey[]

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="flex flex-col gap-4 pb-6">
        <div>
          <h1 className="text-display-lg text-foreground">Component kit</h1>
          <p className="text-muted mt-2 max-w-2xl text-pretty">
            Every primitive, every state, both themes. If a state is missing here it is missing
            everywhere. Values shown are R2 Candidate A &ldquo;Ink &amp; Paper&rdquo; with type T2.
          </p>
        </div>
        <ThemeSwitch />
      </header>

      <Section
        title="Colour tokens"
        note="Components consume these names, never literal colours. The 28 July decision changes the values in one file; nothing below changes."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['background', 'bg-background'],
            ['card', 'bg-card'],
            ['card-subtle', 'bg-card-subtle'],
            ['accent', 'bg-accent'],
            ['warning', 'bg-warning'],
            ['success', 'bg-success'],
            ['destructive', 'bg-destructive'],
            ['info', 'bg-info'],
          ].map(([name, className]) => (
            <div key={name} className="flex flex-col gap-1.5">
              <div
                className={`border-border h-14 rounded-[--radius-control] border ${className}`}
              />
              <code className="text-muted font-mono text-xs">{name}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type scale" note="T2: display weights 500–600, sizes +10%, tighter leading.">
        <div className="flex flex-col gap-3">
          <p className="text-display-2xl text-foreground">Find a professional</p>
          <p className="text-display-xl text-foreground">Section hero</p>
          <p className="text-display-lg text-foreground">Page title</p>
          <p className="text-display-md text-foreground">Card heading</p>
          <p className="text-display-sm text-foreground">Section heading</p>
          <p className="text-body text-base">
            Body copy at the reading minimum. The measure is capped near 70 characters so lines stay
            comfortable to track on a phone.
          </p>
          <p className="text-muted text-sm">Secondary text and table cells.</p>
          <p className="text-body font-mono text-sm tabular-nums">
            Numerals are mono: {formatTTD(2100)} · {formatRating(4.8)} {formatReviewCount(23)} ·{' '}
            {formatDate('2026-09-07')}
          </p>
        </div>
      </Section>

      <Section
        title="Button"
        note="Six variants, three sizes. Loading locks the width — watch it not reflow."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Suspend listing</Button>
          <Button variant="upgrade">Upgrade to Studio</Button>
          <Button variant="link">Text link</Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
          <Button isLoading={loading} onClick={() => setLoading((v) => !v)}>
            Toggle loading
          </Button>
          <Button iconLeft={<Search />}>With icon</Button>
        </div>
      </Section>

      <Section
        title="Badge"
        note="The status-colour law. The same state is the same colour on every surface — that is the whole value."
      >
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <Badge key={status} status={status}>
              {status.replace(/_/g, ' ')}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="verified">Verified</Badge>
          <Badge variant="student">Student</Badge>
          <Badge variant="registered">Registered business</Badge>
        </div>
      </Section>

      <Section
        title="Card"
        note="Flat by default. Interactive cards take the whole surface as one target."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Flat</CardTitle>
              <CardDescription>Border only. The resting state.</CardDescription>
            </CardHeader>
          </Card>
          <Card elevation="raised">
            <CardHeader>
              <CardTitle>Raised</CardTitle>
              <CardDescription>Hovered cards and dropdowns.</CardDescription>
            </CardHeader>
          </Card>
          <Card interactive>
            <CardHeader>
              <CardTitle>Interactive</CardTitle>
              <CardDescription>Lifts on hover, presses on click.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Section>

      <Section
        title="Input"
        note="Errors are announced, not merely coloured. Tab through to hear it."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Business name" placeholder="Ravi's Plumbing" required />
          <Input label="From price" prefix="TTD $" placeholder="150" inputMode="numeric" />
          <Input
            label="Email"
            type="email"
            error="Enter an email address that includes an @ symbol."
            defaultValue="not-an-email"
          />
          <Input label="Area" hint="Where you usually work. You can add more later." />
          <div className="sm:col-span-2">
            <Textarea
              label="Describe what you need"
              hint="Twenty characters minimum. The more detail, the better the quotes."
              maxLength={1000}
              showCount
              placeholder="My kitchen tap has been dripping for a week…"
            />
          </div>
        </div>
      </Section>

      <Section
        title="States"
        note="Loading, empty, and error exist for every data surface. Skeletons mirror the real geometry."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <ProfessionalCardSkeleton />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Card padding="none">
              <EmptyState
                icon={Inbox}
                heading="No enquiries yet"
                body="When a customer contacts you, it lands here. Sharing your storefront link is the fastest way to the first one."
                action={{ label: 'Copy storefront link' }}
              />
            </Card>
            <Card padding="none">
              <ErrorState onRetry={() => undefined} />
            </Card>
          </div>
        </div>
      </Section>

      <Section
        title="Pricing"
        note="Rendered from lib/constants/pricing.ts. Change a value there and this follows with no copy edits."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TIER_ORDER.map((id) => {
            const tier = TIERS[id]
            return (
              <Card key={id} elevation={id === 'growth' ? 'raised' : 'flat'}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{tier.name}</CardTitle>
                    {id === 'growth' && <Badge variant="active">Most popular</Badge>}
                  </div>
                  <CardDescription>{tier.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-display-md text-foreground font-mono tabular-nums">
                    {formatTTD(tier.monthly)}
                    <span className="text-muted text-sm">/mo</span>
                  </p>
                  <p className="text-muted mt-2 text-xs">
                    Registered: {formatTTD(monthlyTotal(id, 'registered', 0))}/mo · Sole trader
                    after 6 months: {formatTTD(monthlyTotal(id, 'sole_trader', 6))}/mo
                  </p>
                  <ul className="mt-3 flex flex-col gap-1">
                    {tier.adds.map((item) => (
                      <li key={item} className="text-body flex items-start gap-2 text-sm">
                        <ShieldCheck
                          className="text-success mt-0.5 size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </Section>
    </main>
  )
}
