import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Users, Sparkles, MessageCircle } from 'lucide-react'
import { requireProfessional } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { tierHasFeature, lowestTierWith, PRICING_MODE, TIERS } from '@/lib/constants/pricing'
import { getClients } from '@/lib/crm/queries'
import { EmptyState } from '@/components/ui/States'
import { Button } from '@/components/ui/Button'
import { BlurFade } from '@/components/ui/blur-fade'
import { formatTTD, formatRelativeTime } from '@/lib/utils/format'
import { whatsappDigits } from '@/lib/whatsapp'

export const metadata: Metadata = { title: 'Clients' }

// Per-professional live book; also tier-gated — never cache.
export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const access = await requireProfessional()
  if (!access.ok) redirect(loginRedirect('/clients'))

  // Gate WITH a real teaser (spec §5.7): lower tiers see what the CRM does and
  // how to unlock it, not a bare 403. Launch mode (D62) opens the CRM to every
  // professional — the teaser waits with the rest of the tier machinery.
  if (PRICING_MODE === 'tiers' && (!access.tier || !tierHasFeature(access.tier, 'crm'))) {
    const needed = lowestTierWith('crm')
    return <CrmTeaser requiredTierName={needed ? TIERS[needed].name : 'Studio'} />
  }

  const clients = await getClients(access.supabase)

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <BlurFade delay={0} className="mb-6">
        <h1 className="text-foreground font-display text-2xl tracking-tight">Clients</h1>
        <p className="text-muted mt-1 text-sm">
          Everyone who has reached you, built automatically from your enquiries.
        </p>
      </BlurFade>

      {clients.length === 0 ? (
        <BlurFade delay={0.08}>
          <EmptyState
            icon={Users}
            heading="No clients yet"
            body="As customers enquire, they appear here with their history and value — nothing to set up."
          />
        </BlurFade>
      ) : (
        <BlurFade delay={0.08}>
          <ul className="flex flex-col gap-2">
            {clients.map((c) => {
              const digits = c.whatsapp ? whatsappDigits(c.whatsapp) : null
              const waHref = digits ? `https://wa.me/${digits}` : undefined
              return (
                <li
                  key={c.id}
                  className="border-border bg-card flex items-center justify-between gap-4 rounded-[--radius-card] border p-4"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">{c.displayName}</p>
                    <p className="text-muted mt-0.5 text-xs">
                      {c.area ? `${c.area} · ` : ''}
                      <span className="font-mono tabular-nums">{c.enquiryCount}</span>{' '}
                      {c.enquiryCount === 1 ? 'enquiry' : 'enquiries'}
                      {c.lastActivityAt ? ` · ${formatRelativeTime(c.lastActivityAt)}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {c.lifetimeValueTtd > 0 && (
                      <span className="text-foreground font-mono text-sm tabular-nums">
                        {formatTTD(c.lifetimeValueTtd)}
                      </span>
                    )}
                    {waHref && (
                      <Button asChild variant="ghost" size="sm">
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`WhatsApp ${c.displayName}`}
                        >
                          <MessageCircle className="size-4" aria-hidden="true" />
                        </a>
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </BlurFade>
      )}
    </div>
  )
}

/** The real teaser (spec §5.7) — what the CRM does, and the upgrade path. */
function CrmTeaser({ requiredTierName }: { requiredTierName: string }) {
  const perks = [
    'Every customer who enquires, saved automatically',
    'Job history and lifetime value per client',
    'Tags and private notes to remember what matters',
    'One-tap WhatsApp back to any client',
  ]
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6">
      <BlurFade className="border-border bg-card relative isolate overflow-hidden rounded-[--radius-panel] border p-8 text-center">
        <span
          aria-hidden="true"
          className="bg-accent/5 pointer-events-none absolute -top-12 -right-12 size-48 rounded-full blur-3xl"
        />
        <span className="bg-accent-soft text-accent-ink mx-auto flex size-12 items-center justify-center rounded-full">
          <Sparkles className="size-6" aria-hidden="true" />
        </span>
        <h1 className="text-foreground font-display mt-4 text-2xl tracking-tight">
          Your clients, remembered
        </h1>
        <p className="text-muted mt-2 text-sm">
          The CRM turns your enquiries into a real client book — available on {requiredTierName} and
          up.
        </p>
        <ul className="mx-auto mt-6 flex max-w-sm flex-col gap-2 text-left">
          {perks.map((perk) => (
            <li key={perk} className="text-body flex items-start gap-2 text-sm">
              <span
                className="bg-success mt-1.5 size-1.5 shrink-0 rounded-full"
                aria-hidden="true"
              />
              {perk}
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <Button asChild>
            <Link href="/subscription">Upgrade to {requiredTierName}</Link>
          </Button>
        </div>
      </BlurFade>
    </div>
  )
}
