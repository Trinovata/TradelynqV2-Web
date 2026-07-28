import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Workflow, Sparkles } from 'lucide-react'
import { requireProfessional } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { tierHasFeature, lowestTierWith, TIERS } from '@/lib/constants/pricing'
import { Button } from '@/components/ui/Button'
import { BlurFade } from '@/components/ui/blur-fade'
import { IntegrationsClient, type WebhookRow, type DeliveryRow } from '@/components/professional/IntegrationsClient'

export const metadata: Metadata = { title: 'Integrations' }

// Live per-professional state and tier-gated — never cache.
export const dynamic = 'force-dynamic'

export default async function IntegrationsPage() {
  const access = await requireProfessional()
  if (!access.ok) redirect(loginRedirect('/integrations'))

  // Gate WITH a real teaser: lower tiers see what automation unlocks and the
  // upgrade path, not a bare 403.
  if (!access.tier || !tierHasFeature(access.tier, 'webhooks')) {
    const needed = lowestTierWith('webhooks')
    return <IntegrationsTeaser requiredTierName={needed ? TIERS[needed].name : 'Enterprise'} />
  }

  const [configsRes, deliveriesRes] = await Promise.all([
    access.supabase
      .from('webhook_configs')
      .select(
        'id, url, events, is_active, consecutive_failures, disabled_at, disabled_reason, last_success_at, created_at'
      )
      .eq('professional_id', access.professionalId)
      .order('created_at', { ascending: false }),
    access.supabase
      .from('webhook_delivery_log')
      .select('id, webhook_config_id, event_type, status_code, succeeded, attempt, duration_ms, created_at')
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  return (
    <IntegrationsClient
      initialWebhooks={(configsRes.data ?? []) as WebhookRow[]}
      initialDeliveries={(deliveriesRes.data ?? []) as DeliveryRow[]}
    />
  )
}

/** The upgrade teaser — what automation unlocks, and the path to it. */
function IntegrationsTeaser({ requiredTierName }: { requiredTierName: string }) {
  const perks = [
    'Signed webhooks for every enquiry, quote, job, and invoice',
    'Connect n8n, Zapier, or any endpoint — no code required',
    'Automate WhatsApp replies, accounting, and follow-ups',
    'A full delivery log, with retries and auto-recovery',
  ]
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6">
      <BlurFade className="border-border bg-card shadow-e1 relative isolate overflow-hidden rounded-[--radius-panel] border p-8 text-center">
        <span
          aria-hidden="true"
          className="bg-accent/5 pointer-events-none absolute -top-12 -right-12 size-48 rounded-full blur-3xl"
        />
        <span className="bg-accent-soft text-accent-ink mx-auto flex size-12 items-center justify-center rounded-full">
          <Sparkles className="size-6" aria-hidden="true" />
        </span>
        <h1 className="text-foreground font-display mt-4 text-2xl tracking-tight">
          Automate everything
        </h1>
        <p className="text-muted mt-2 text-sm text-pretty">
          Push a signed event to your own tools the moment anything happens in your workspace —
          available on {requiredTierName}.
        </p>
        <ul className="mx-auto mt-6 flex max-w-sm flex-col gap-2 text-left">
          {perks.map((perk) => (
            <li key={perk} className="text-body flex items-start gap-2 text-sm">
              <span className="bg-success mt-1.5 size-1.5 shrink-0 rounded-full" aria-hidden="true" />
              {perk}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Button asChild>
            <Link href="/subscription">Upgrade to {requiredTierName}</Link>
          </Button>
          <Button asChild variant="link">
            <a href="https://docs.tradelynq.com/integrations/n8n" target="_blank" rel="noreferrer">
              <Workflow className="size-4" aria-hidden="true" />
              See how the n8n integration works
            </a>
          </Button>
        </div>
      </BlurFade>
    </div>
  )
}
