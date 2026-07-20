'use client'

import * as React from 'react'
import { Search, Inbox, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, STATUS_VARIANT, type StatusKey } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { Skeleton, ProfessionalCardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { RadioGroup, Radio } from '@/components/ui/Radio'
import { Switch } from '@/components/ui/Switch'
import { Modal } from '@/components/ui/Modal'
import { Sheet } from '@/components/ui/Sheet'
import { Toaster, toast } from '@/components/ui/Toast'
import { Tooltip } from '@/components/ui/Tooltip'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar, type AvatarSize } from '@/components/ui/Avatar'
import { StarRating } from '@/components/ui/StarRating'
import { ProgressBar, StepIndicator } from '@/components/ui/Progress'
import { Table, type TableColumn } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Banner } from '@/components/ui/Banner'
import { ProfessionalCard } from '@/components/shared/ProfessionalCard'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { ReviewCard, DistributionBar } from '@/components/shared/ReviewCard'
import { StatCard } from '@/components/shared/StatCard'
import { Timeline } from '@/components/shared/Timeline'
import { PricingTierCards } from '@/components/shared/PricingTierCards'
import { AdSlot } from '@/components/shared/AdSlot'
import { CatalogueGrid } from '@/components/shared/CatalogueGrid'
import type { ProfessionalCardData } from '@/lib/marketplace/professional-card'
import { useTheme, type ThemePreference } from '@/components/layout/ThemeProvider'
import { formatTTD, formatRating, formatReviewCount, formatDate } from '@/lib/utils/format'
import { TIERS, TIER_ORDER, monthlyTotal } from '@/lib/constants/pricing'

// ── Pattern fixtures ─────────────────────────────────────────────────────────
// Same realistic T&T supply the dev seed uses, so the composed patterns are
// reviewed against data the real surfaces will carry.

const CARD_FIXTURE: ProfessionalCardData = {
  id: 'p1',
  slug: 'baptiste-electrical',
  name: 'Baptiste Electrical Services',
  avatarUrl: null,
  category: { slug: 'electrician', name: 'Electrician' },
  areas: ['Arima', 'Tunapuna', 'Sangre Grande', 'Port of Spain'],
  rating: { average: 4.5, count: 12 },
  verification: { idVerified: true, insured: true, fullyVerified: true },
  track: 'registered',
  fromPriceTTD: 250,
  responseHint: 'Responds in ~2h',
}

const NEW_CARD_FIXTURE: ProfessionalCardData = {
  id: 'p2',
  slug: 'kevon-web',
  name: 'Kevon Samuel Web',
  avatarUrl: null,
  category: { slug: 'web-designer', name: 'Web Designer' },
  areas: ['St Augustine', 'Curepe'],
  rating: null, // below the D40 threshold — renders the "New" chip
  verification: { idVerified: false, insured: false, fullyVerified: false },
  track: 'student',
  fromPriceTTD: 1500,
}

const TIMELINE_EVENTS = [
  {
    id: '1',
    kind: 'status_change',
    label: 'Enquiry sent',
    timestamp: '2026-07-18T09:00:00Z',
    status: 'pending' as const,
  },
  {
    id: '2',
    kind: 'status_change',
    label: 'Accepted by professional',
    detail: 'Baptiste Electrical',
    timestamp: '2026-07-18T11:30:00Z',
    status: 'accepted' as const,
  },
  {
    id: '3',
    kind: 'invoice',
    label: 'Invoice paid',
    detail: formatTTD(1800),
    timestamp: '2026-07-19T16:05:00Z',
    status: 'paid' as const,
  },
]

const CATALOGUE_FIXTURE = [
  {
    id: 'c1',
    primaryImage: '',
    imageUrls: [''],
    caption: 'Rewired a whole house in Arima',
    professional: { slug: 'baptiste-electrical', name: 'Baptiste Electrical' },
    saveCount: 8,
    aspectRatio: 4 / 5,
  },
  {
    id: 'c2',
    primaryImage: '',
    imageUrls: [''],
    caption: 'Panel upgrade, Chaguanas',
    professional: { slug: 'persad-plumbing', name: 'Persad Plumbing' },
    saveCount: 3,
    aspectRatio: 1,
  },
]

// ── Gallery fixtures ─────────────────────────────────────────────────────────
// Deliberately the same shape of data the real surfaces carry — Trinidad areas,
// TTD amounts, real category names. A gallery filled with "Option 1 / Option 2"
// makes every layout look fine, because nothing in it is ever an awkward length.

const SHORT_OPTIONS = [
  { value: 'electrician', label: 'Electrician' },
  { value: 'plumber', label: 'Plumber' },
  { value: 'hairstylist', label: 'Hairstylist' },
  { value: 'photographer', label: 'Photographer' },
] satisfies { value: string; label: string }[]

// Over the eight-option threshold, so Select turns itself searchable. Grouped by
// region, and deliberately NOT alphabetised — the regional order carries meaning
// that sorting would destroy.
const AREA_OPTIONS = [
  { value: 'port-of-spain', label: 'Port of Spain', group: 'North' },
  { value: 'diego-martin', label: 'Diego Martin', group: 'North' },
  { value: 'maraval', label: 'Maraval', group: 'North' },
  { value: 'arima', label: 'Arima', group: 'East' },
  { value: 'tunapuna', label: 'Tunapuna', group: 'East' },
  { value: 'sangre-grande', label: 'Sangre Grande', group: 'East' },
  { value: 'chaguanas', label: 'Chaguanas', group: 'Central' },
  { value: 'couva', label: 'Couva', group: 'Central' },
  { value: 'san-fernando', label: 'San Fernando', group: 'South' },
  { value: 'point-fortin', label: 'Point Fortin', group: 'South' },
  { value: 'scarborough', label: 'Scarborough', group: 'Tobago' },
] satisfies { value: string; label: string; group: string }[]

const KIT_TABS = [
  { value: 'all', label: 'All', count: 12 },
  { value: 'pending', label: 'Pending', count: 3 },
  { value: 'accepted', label: 'Accepted', count: 8 },
  { value: 'declined', label: 'Declined', count: 1 },
] satisfies { value: string; label: string; count: number }[]

const AVATAR_SIZES: AvatarSize[] = [24, 32, 40, 64, 96]

type InvoiceRow = {
  reference: string
  client: string
  amount: number
  status: StatusKey
  statusLabel: string
}

const INVOICE_ROWS: InvoiceRow[] = [
  {
    reference: 'INV-0041',
    client: 'Simone Job',
    amount: 1800,
    status: 'completed',
    statusLabel: 'Paid',
  },
  {
    reference: 'INV-0042',
    client: 'Andre Williams',
    amount: 450,
    status: 'pending',
    statusLabel: 'Sent',
  },
  {
    reference: 'INV-0043',
    client: 'Lisa Rampersad',
    amount: 12500,
    status: 'draft',
    statusLabel: 'Draft',
  },
]

const INVOICE_COLUMNS: TableColumn<InvoiceRow>[] = [
  { key: 'reference', header: 'Reference' },
  { key: 'client', header: 'Client', sortable: true },
  {
    key: 'amount',
    header: 'Amount',
    numeric: true,
    sortable: true,
    render: (row) => formatTTD(row.amount),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge status={row.status}>{row.statusLabel}</Badge>,
  },
]

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

  // Gallery state. Each control is genuinely interactive rather than a static
  // screenshot: a primitive that only ever renders its default state hides
  // exactly the bugs a gallery exists to catch.
  const [category, setCategory] = React.useState<string | null>(null)
  const [area, setArea] = React.useState<string | null>(null)
  const [accepted, setAccepted] = React.useState(false)
  const [contact, setContact] = React.useState('whatsapp')
  const [listed, setListed] = React.useState(true)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [tab, setTab] = React.useState<string>('all')
  const [rating, setRating] = React.useState(4)
  const [page, setPage] = React.useState(1)

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

      <Section
        title="Form controls"
        note="Select falls back to a searchable combobox at eight or more options. Every control's whole label row is clickable, and the 20px visuals sit inside 44px hit areas."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Select
              label="Category"
              options={SHORT_OPTIONS}
              value={category}
              onChange={setCategory}
              placeholder="Choose a category"
              clearable
              onClear={() => setCategory(null)}
            />
            <Select
              label="Service area"
              hint="Auto-searchable — this list is over the eight-option threshold."
              options={AREA_OPTIONS}
              value={area}
              onChange={setArea}
              placeholder="Choose an area"
            />
            <Select
              label="Category"
              options={SHORT_OPTIONS}
              value={null}
              onChange={() => undefined}
              placeholder="Choose a category"
              error="Choose a category so customers can find you."
            />
          </div>

          <div className="flex flex-col gap-4">
            <Checkbox
              label="I accept the Terms of Service"
              description="Required before your listing can go live."
              checked={accepted}
              onCheckedChange={(next) => setAccepted(next === true)}
            />
            <Checkbox label="Disabled, unchecked" disabled />
            <Checkbox
              label="With an error"
              error="You must accept the Terms of Service to continue."
            />

            <RadioGroup
              label="Contact preference"
              value={contact}
              onValueChange={setContact}
              hint="How customers reach you first."
            >
              <Radio value="whatsapp" label="WhatsApp" />
              <Radio value="call" label="Call" />
              <Radio value="email" label="Email" />
            </RadioGroup>

            <Switch
              label="Listing visible"
              description="Turning this off hides you from search immediately."
              checked={listed}
              onCheckedChange={setListed}
            />
            <Switch label="Disabled switch" disabled />
          </div>
        </div>
      </Section>

      <Section
        title="Overlays"
        note="Modal renders as a bottom Sheet below 768px automatically — narrow the window and reopen it. Toasts stack to three, oldest first."
      >
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Open sheet
          </Button>
          <Button variant="secondary" onClick={() => toast('Storefront link copied.')}>
            Toast — success
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast('That enquiry could not be sent.', {
                kind: 'error',
                action: { label: 'Retry', onClick: () => toast('Sent.') },
              })
            }
          >
            Toast — error with action
          </Button>
          <Tooltip content="Visible to customers on your storefront">
            <Button variant="ghost">Hover for a tooltip</Button>
          </Tooltip>
        </div>

        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Send this quote?"
          description="The customer receives a link they can accept or decline."
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>Send quote</Button>
            </>
          }
        >
          <p className="text-body text-sm">
            Quote total {formatTTD(4500)} for Baptiste Electrical Services. Once sent, the quote
            cannot be edited — you would issue a replacement instead.
          </p>
        </Modal>

        <Sheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Filter results"
          description="Narrow the list by area and rating."
        >
          <div className="flex flex-col gap-4 pb-2">
            <Select
              label="Service area"
              options={AREA_OPTIONS}
              value={area}
              onChange={setArea}
              placeholder="Any area"
            />
            <StarRating value={rating} interactive onChange={setRating} label="Minimum rating" />
          </div>
        </Sheet>
      </Section>

      <Section
        title="Navigation and progress"
        note="Tab counts and every numeral render in mono with tabular figures, so a changing number never shifts its neighbours."
      >
        <div className="flex flex-col gap-8">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Electricians', href: '/categories/electrician' },
              { label: 'Baptiste Electrical Services' },
            ]}
          />

          <Tabs tabs={KIT_TABS} value={tab} onChange={setTab} label="Enquiries" />

          <div className="grid gap-6 md:grid-cols-2">
            <ProgressBar value={3} max={5} label="Profile strength" showPercentage />
            <ProgressBar value={27} max={30} label="Invoices this month" showPercentage />
          </div>

          <StepIndicator
            steps={['Basics', 'Services', 'Areas', 'Verification', 'Plan']}
            current={3}
          />

          <Pagination page={page} total={8} onChange={setPage} />
        </div>
      </Section>

      <Section
        title="Identity and rating"
        note="Initials are derived from the name, never passed in — so the same person cannot render as two different avatars on two surfaces. The verified shield is suppressed below 40px, where it is only a coloured smudge."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end gap-4">
            {AVATAR_SIZES.map((size) => (
              <Avatar key={size} alt="Darren Baptiste" name="Darren Baptiste" size={size} />
            ))}
            <Avatar alt="Nicole Alleyne" name="Nicole Alleyne" size={64} verified />
          </div>

          <div className="flex flex-col gap-3">
            <StarRating value={4.8} count={23} />
            <StarRating value={4} count={2} size={20} />
            <StarRating value={0} count={0} />
            <StarRating value={rating} interactive onChange={setRating} label="Your rating" />
          </div>
        </div>
      </Section>

      <Section
        title="Banners and tables"
        note="One banner per surface — the page resolves which is most urgent, the component never stacks them. Numeric table columns are right-aligned and mono so amounts compare down the column."
      >
        <div className="flex flex-col gap-4">
          <Banner
            kind="info"
            text="Your listing is under review. We aim to decide within 48 hours."
          />
          <Banner
            kind="warning"
            text="Your insurance certificate expires in 14 days."
            action={{ label: 'Upload a new one' }}
          />
          <Banner kind="success" text="Payment received. Your subscription is active." />

          <Table
            caption="Recent invoices"
            columns={INVOICE_COLUMNS}
            rows={INVOICE_ROWS}
            getRowKey={(row) => row.reference}
            mobileCard={(row) => (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-medium">{row.client}</span>
                  <Badge status={row.status}>{row.statusLabel}</Badge>
                </div>
                <span className="text-muted font-mono text-xs tabular-nums">{row.reference}</span>
                <span className="text-foreground font-mono tabular-nums">
                  {formatTTD(row.amount)}
                </span>
              </div>
            )}
          />
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

      <Section
        title="Marketplace patterns"
        note="The composed, domain-aware components pages assemble from (S074). ProfessionalCard is one card for both roles; the 'New' variant shows below the 3-review rating threshold (D40)."
      >
        <div className="flex flex-col gap-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfessionalCard data={CARD_FIXTURE} source="search" onWhatsApp={() => undefined} />
            <ProfessionalCard data={NEW_CARD_FIXTURE} source="search" />
            <ProfessionalCard data={{ ...CARD_FIXTURE, sponsored: true }} source="search" />
            <ProfessionalCard data={CARD_FIXTURE} variant="compact" source="saved" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <WhatsAppButton
              phone="+18683552214"
              template="storefront_intro"
              templateData={{ name: 'Darren' }}
              context="storefront"
              variant="primary-position"
            />
            <WhatsAppButton
              phone="+18683552214"
              template="storefront_intro"
              templateData={{ name: 'Darren' }}
              context="storefront"
              variant="secondary"
            />
            <WhatsAppButton
              phone="+18683552214"
              template="storefront_intro"
              templateData={{ name: 'Darren' }}
              context="storefront"
              variant="icon"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              label="Profile views"
              value={1284}
              format="int"
              trend={{ delta: 12, direction: 'up' }}
            />
            <StatCard label="Earnings this month" value={9800} format="ttd" />
            <StatCard
              label="Response rate"
              value={94}
              format="percent"
              trend={{ delta: 3, direction: 'up' }}
            />
            <StatCard
              label="Churn"
              value={2}
              format="percent"
              trend={{ delta: 1, direction: 'down', goodIsUp: false }}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <ReviewCard
                review={{
                  reviewerLabel: 'Simone J.',
                  date: '18 Jul 2026',
                  stars: 5,
                  testimonial:
                    'Came the same evening, found the fault in the panel and had everything working within two hours. Explained what caused it so it does not happen again. Genuinely the most professional service I have had in years.',
                  verifiedJob: true,
                  seeded: false,
                }}
                flaggable
                onFlag={() => undefined}
              />
              <ReviewCard
                review={{
                  reviewerLabel: 'Devon R.',
                  date: '12 Jun 2026',
                  stars: 4,
                  testimonial: 'Good work and fair price.',
                  verifiedJob: false,
                  seeded: true,
                }}
              />
            </div>
            <DistributionBar
              distribution={{ '5': 9, '4': 2, '3': 1, '2': 0, '1': 0 }}
              average={4.5}
            />
          </div>

          <Timeline events={TIMELINE_EVENTS} />

          <div className="grid gap-4 md:grid-cols-3">
            <AdSlot zone="pro_workspace" campaign={null} />
            <AdSlot
              zone="pro_workspace"
              campaign={{
                id: 'ad1',
                creativeUrl: '',
                linkUrl: 'https://example.test',
                companyName: 'Republic Bank',
              }}
            />
          </div>

          <CatalogueGrid
            posts={CATALOGUE_FIXTURE}
            onLoadMore={() => undefined}
            hasMore={false}
            loading={false}
          />
        </div>
      </Section>

      <Section
        title="Pricing tiers (crossover-aware)"
        note="Rendered entirely from pricing.ts — the account layer shows as its own line under the cards, framed as the Registered rate, never a surcharge (D49)."
      >
        <PricingTierCards
          tiers={TIER_ORDER.map((id) => TIERS[id])}
          accountTrack="sole_trader"
          billingPeriod="monthly"
          pioneerActive
          context="public"
          onSelect={() => undefined}
        />
      </Section>

      {/* Mounted once for the whole gallery — the live region must not be duplicated. */}
      <Toaster />
    </main>
  )
}
