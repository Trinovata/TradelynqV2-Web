'use client'

/**
 * The Integrations workspace tool (playbook S116).
 *
 * Where an Enterprise professional wires their workspace to the outside world:
 * add an HTTPS endpoint, choose which events push to it, and TradeLynq delivers a
 * signed copy of each. Built for the n8n case first — the quickstart names the
 * exact nodes — but it is a plain signed-webhook surface any consumer can use.
 *
 * The one irreversible moment is secret creation: the signing secret is shown
 * exactly once, in a modal that says so plainly, because it is stored only
 * encrypted and can never be revealed again (see lib/webhooks/crypto.ts). Every
 * other action is forgiving — pause, edit, reactivate, delete.
 */

import * as React from 'react'
import {
  Workflow,
  Plus,
  Trash2,
  Send,
  Copy,
  Check,
  CircleAlert,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Checkbox } from '@/components/ui/Checkbox'
import { EmptyState } from '@/components/ui/States'
import { BlurFade } from '@/components/ui/blur-fade'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils/cn'
import { formatRelativeTime } from '@/lib/utils/format'
import {
  EVENT_GROUPS,
  EVENT_REGISTRY,
  eventsByGroup,
  isEventType,
  type EventType,
} from '@/lib/events/catalog'

export type WebhookRow = {
  id: string
  url: string
  events: string[]
  is_active: boolean
  consecutive_failures: number
  disabled_at: string | null
  disabled_reason: string | null
  last_success_at: string | null
  created_at: string
}

export type DeliveryRow = {
  id: string
  webhook_config_id: string
  event_type: string
  status_code: number | null
  succeeded: boolean
  attempt: number
  duration_ms: number | null
  created_at: string
}

const GROUP_LABEL: Record<(typeof EVENT_GROUPS)[number], string> = {
  enquiries: 'Enquiries',
  quotes: 'Quotes',
  jobs: 'Jobs',
  invoices: 'Invoices',
  reviews: 'Reviews',
  system: 'System',
}

const DOCS_URL = 'https://docs.tradelynq.com/integrations/n8n'

// ── API helper ───────────────────────────────────────────────────────────────

type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string }

async function api<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, message: json?.error ?? 'Something went wrong. Please try again.' }
    }
    return { ok: true, data: json.data as T }
  } catch {
    return { ok: false, message: 'Network error. Check your connection and try again.' }
  }
}

// ── Root ─────────────────────────────────────────────────────────────────────

export function IntegrationsClient({
  initialWebhooks,
  initialDeliveries,
}: {
  initialWebhooks: WebhookRow[]
  initialDeliveries: DeliveryRow[]
}) {
  const [webhooks, setWebhooks] = React.useState(initialWebhooks)
  const [deliveries] = React.useState(initialDeliveries)
  const [addOpen, setAddOpen] = React.useState(false)
  const [revealedSecret, setRevealedSecret] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<WebhookRow | null>(null)

  const upsert = React.useCallback((row: WebhookRow) => {
    setWebhooks((prev) => {
      const i = prev.findIndex((w) => w.id === row.id)
      if (i === -1) return [row, ...prev]
      const next = [...prev]
      next[i] = row
      return next
    })
  }, [])

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-10">
      <BlurFade delay={0} className="mb-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-foreground font-display text-2xl tracking-tight">Integrations</h1>
            <p className="text-muted mt-1 text-sm text-pretty">
              Push a signed event to your own tools the moment anything happens in your workspace.
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Add endpoint
          </Button>
        </header>
      </BlurFade>

      <BlurFade delay={0.08} className="mb-6">
        <Quickstart />
      </BlurFade>

      <BlurFade delay={0.14} className="mb-8">
        {webhooks.length === 0 ? (
          <EmptyState
            icon={Workflow}
            heading="No endpoints yet"
            body="Add an HTTPS endpoint — your n8n webhook URL, say — and choose which events it should receive."
            action={{ label: 'Add your first endpoint', onClick: () => setAddOpen(true) }}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {webhooks.map((webhook) => (
              <EndpointRow
                key={webhook.id}
                webhook={webhook}
                onChange={upsert}
                onDelete={() => setDeleteTarget(webhook)}
              />
            ))}
          </ul>
        )}
      </BlurFade>

      {deliveries.length > 0 && (
        <BlurFade delay={0.2}>
          <DeliveryLog deliveries={deliveries} />
        </BlurFade>
      )}

      <AddEndpointModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(row, secret) => {
          upsert(row)
          setAddOpen(false)
          setRevealedSecret(secret)
        }}
      />

      <SecretModal secret={revealedSecret} onClose={() => setRevealedSecret(null)} />

      <DeleteModal
        target={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onDeleted={(id) => {
          setWebhooks((prev) => prev.filter((w) => w.id !== id))
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}

// ── n8n quickstart ───────────────────────────────────────────────────────────

function Quickstart() {
  const steps = [
    'In n8n, add a Webhook node and copy its Production URL.',
    'Add it here as an endpoint and choose the events to receive.',
    'Paste the signing secret into an n8n credential to verify each delivery.',
    'Send a test ping, then build your workflow on the events that arrive.',
  ]
  return (
    <section className="border-border bg-card shadow-e1 rounded-[--radius-card] border p-5">
      <div className="flex items-start gap-3">
        <span className="bg-accent-soft text-accent-ink flex size-9 shrink-0 items-center justify-center rounded-[--radius-control]">
          <Workflow className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-foreground font-medium">Connect n8n in four steps</h2>
          <p className="text-muted mt-0.5 text-sm text-pretty">
            Every delivery is signed with HMAC-SHA256, so your workflow can trust it came from us.
          </p>
          <ol className="mt-3 flex flex-col gap-1.5">
            {steps.map((step, i) => (
              <li key={step} className="text-body flex items-start gap-2.5 text-sm">
                <span className="bg-card-subtle text-muted mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-xs tabular-nums">
                  {i + 1}
                </span>
                <span className="text-pretty">{step}</span>
              </li>
            ))}
          </ol>
          <Button asChild variant="link" className="mt-3">
            <a href={DOCS_URL} target="_blank" rel="noreferrer">
              Full guide and event reference
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}

// ── Endpoint row ─────────────────────────────────────────────────────────────

function EndpointRow({
  webhook,
  onChange,
  onDelete,
}: {
  webhook: WebhookRow
  onChange: (row: WebhookRow) => void
  onDelete: () => void
}) {
  const [busy, setBusy] = React.useState<null | 'test' | 'toggle' | 'reactivate'>(null)
  const disabled = webhook.disabled_at !== null

  async function test() {
    setBusy('test')
    const result = await api<{ test: { succeeded: boolean; statusCode?: number; error?: string } }>(
      `/api/professional/webhooks/${webhook.id}/test`,
      { method: 'POST' }
    )
    setBusy(null)
    if (!result.ok) return toast(result.message, { kind: 'error' })
    if (result.data.test.succeeded) {
      toast(`Delivered — endpoint answered ${result.data.test.statusCode ?? 'OK'}.`, {
        kind: 'success',
      })
    } else {
      toast(`Test failed: ${result.data.test.error ?? 'no response'}.`, { kind: 'error' })
    }
  }

  async function toggleActive(next: boolean) {
    setBusy('toggle')
    const result = await api<{ webhook: WebhookRow }>(`/api/professional/webhooks/${webhook.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: next }),
    })
    setBusy(null)
    if (!result.ok) return toast(result.message, { kind: 'error' })
    onChange(result.data.webhook)
  }

  async function reactivate() {
    setBusy('reactivate')
    const result = await api<{ webhook: WebhookRow }>(`/api/professional/webhooks/${webhook.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: true }),
    })
    setBusy(null)
    if (!result.ok) return toast(result.message, { kind: 'error' })
    onChange(result.data.webhook)
    toast('Endpoint reactivated.', { kind: 'success' })
  }

  return (
    <li className="border-border bg-card shadow-e1 rounded-[--radius-card] border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusBadge webhook={webhook} />
            <p className="text-foreground truncate font-mono text-sm" title={webhook.url}>
              {webhook.url}
            </p>
          </div>
          <p className="text-muted mt-1.5 text-xs">
            <span className="font-mono tabular-nums">{webhook.events.length}</span>{' '}
            {webhook.events.length === 1 ? 'event' : 'events'}
            {webhook.last_success_at
              ? ` · last delivered ${formatRelativeTime(webhook.last_success_at)}`
              : ' · no deliveries yet'}
          </p>
          <EventChips events={webhook.events} />
          {disabled && (
            <p className="text-destructive mt-2 flex items-start gap-1.5 text-xs">
              <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span className="text-pretty">
                {webhook.disabled_reason ?? 'Auto-disabled after repeated failures.'}
              </span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={test}
            isLoading={busy === 'test'}
            aria-label="Send test ping"
          >
            <Send className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            aria-label="Delete endpoint"
            className="text-muted hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="border-border mt-3 flex items-center justify-between border-t pt-3">
        {disabled ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={reactivate}
            isLoading={busy === 'reactivate'}
          >
            Reactivate
          </Button>
        ) : (
          <Switch
            checked={webhook.is_active}
            onCheckedChange={toggleActive}
            disabled={busy === 'toggle'}
            label={webhook.is_active ? 'Active' : 'Paused'}
          />
        )}
      </div>
    </li>
  )
}

function StatusBadge({ webhook }: { webhook: WebhookRow }) {
  if (webhook.disabled_at) return <Badge variant="stopped">Disabled</Badge>
  if (!webhook.is_active) return <Badge variant="neutral">Paused</Badge>
  return <Badge variant="complete">Active</Badge>
}

function EventChips({ events }: { events: string[] }) {
  const shown = events.slice(0, 4)
  const extra = events.length - shown.length
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {shown.map((type) => (
        <span
          key={type}
          className="bg-card-subtle text-body rounded-[--radius-tag] px-1.5 py-0.5 font-mono text-[11px]"
        >
          {type}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-muted rounded-[--radius-tag] px-1.5 py-0.5 text-[11px]">
          +{extra} more
        </span>
      )}
    </div>
  )
}

// ── Add-endpoint modal ───────────────────────────────────────────────────────

function AddEndpointModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (row: WebhookRow, secret: string) => void
}) {
  const grouped = React.useMemo(() => eventsByGroup(), [])
  const [url, setUrl] = React.useState('')
  const [selected, setSelected] = React.useState<Set<EventType>>(new Set())
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reset the form each time the modal opens — done as a render-phase state
  // adjustment keyed on the open transition (React's sanctioned "reset state when
  // a prop changes" pattern), not an effect, so there is no cascading re-render.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setUrl('')
      setSelected(new Set())
      setError(null)
    }
  }

  function toggle(type: EventType) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  async function submit() {
    setError(null)
    if (!url.trim().startsWith('https://')) {
      return setError('Enter an HTTPS endpoint URL.')
    }
    if (selected.size === 0) {
      return setError('Choose at least one event to receive.')
    }
    setSubmitting(true)
    const result = await api<{ webhook: WebhookRow; signing_secret: string }>(
      '/api/professional/webhooks',
      { method: 'POST', body: JSON.stringify({ url: url.trim(), events: [...selected] }) }
    )
    setSubmitting(false)
    if (!result.ok) return setError(result.message)
    onCreated(result.data.webhook, result.data.signing_secret)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add an endpoint"
      description="TradeLynq will POST a signed copy of each chosen event to this URL."
    >
      <div className="flex flex-col gap-5">
        <Input
          label="Endpoint URL"
          hint="Your n8n Webhook node's Production URL, or any HTTPS endpoint."
          placeholder="https://n8n.example.com/webhook/tradelynq"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />

        <div>
          <p className="text-foreground text-sm font-medium">Events</p>
          <p className="text-muted mt-0.5 text-xs">Only the events you tick are delivered.</p>
          <div className="mt-3 flex flex-col gap-4">
            {EVENT_GROUPS.map((group) => {
              const items = grouped[group]
              if (items.length === 0) return null
              return (
                <fieldset key={group}>
                  <legend className="text-muted text-[10px] font-semibold tracking-[0.12em] uppercase">
                    {GROUP_LABEL[group]}
                  </legend>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {items.map((item) => (
                      <Checkbox
                        key={item.type}
                        checked={selected.has(item.type)}
                        onCheckedChange={() => toggle(item.type)}
                        label={item.label}
                        description={item.description}
                      />
                    ))}
                  </div>
                </fieldset>
              )
            })}
          </div>
        </div>

        {error && (
          <p className="text-destructive flex items-start gap-1.5 text-sm" role="alert">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            isLoading={submitting}
            loadingLabel="Creating…"
            disabled={selected.size === 0 || url.trim() === ''}
          >
            Create endpoint
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Secret reveal (shown once) ───────────────────────────────────────────────

function SecretModal({ secret, onClose }: { secret: string | null; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('Could not copy — select and copy the secret manually.', { kind: 'error' })
    }
  }

  return (
    <Modal
      open={secret !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Save your signing secret"
      description="This is the only time it will be shown. Store it in n8n now — we keep only an encrypted copy and can never display it again."
    >
      <div className="flex flex-col gap-4">
        <div className="border-border bg-card-subtle flex items-center gap-2 rounded-[--radius-control] border p-3">
          <code className="text-foreground min-w-0 flex-1 truncate font-mono text-sm">{secret}</code>
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? (
              <Check className="size-4 text-success" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <p className="text-muted text-xs text-pretty">
          Verify each delivery by computing <span className="font-mono">HMAC-SHA256</span> of the raw
          request body with this secret and comparing it to the{' '}
          <span className="font-mono">X-TradeLynq-Signature</span> header.
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose}>I&rsquo;ve saved it</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Delete confirm ───────────────────────────────────────────────────────────

function DeleteModal({
  target,
  onOpenChange,
  onDeleted,
}: {
  target: WebhookRow | null
  onOpenChange: (open: boolean) => void
  onDeleted: (id: string) => void
}) {
  const [busy, setBusy] = React.useState(false)

  async function confirm() {
    if (!target) return
    setBusy(true)
    const result = await api<{ deleted: string }>(`/api/professional/webhooks/${target.id}`, {
      method: 'DELETE',
    })
    setBusy(false)
    if (!result.ok) return toast(result.message, { kind: 'error' })
    onDeleted(target.id)
    toast('Endpoint deleted.', { kind: 'success' })
  }

  return (
    <Modal
      open={target !== null}
      onOpenChange={onOpenChange}
      title="Delete this endpoint?"
      description="It stops receiving events immediately, and its delivery history is removed. This cannot be undone."
    >
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={confirm} isLoading={busy} loadingLabel="Deleting…">
          Delete endpoint
        </Button>
      </div>
    </Modal>
  )
}

// ── Delivery log ─────────────────────────────────────────────────────────────

function DeliveryLog({ deliveries }: { deliveries: DeliveryRow[] }) {
  return (
    <section className="border-border bg-card shadow-e1 overflow-hidden rounded-[--radius-card] border">
      <div className="border-border border-b px-5 py-3.5">
        <h2 className="text-foreground text-sm font-medium">Recent deliveries</h2>
      </div>
      <ul className="divide-border divide-y">
        {deliveries.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-5 py-3">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                d.succeeded ? 'bg-success' : 'bg-destructive'
              )}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate font-mono text-xs">
                {isEventType(d.event_type) ? EVENT_REGISTRY[d.event_type].label : d.event_type}
              </p>
              <p className="text-muted text-xs">
                <span className="font-mono">{d.event_type}</span>
                {' · '}
                {formatRelativeTime(d.created_at)}
              </p>
            </div>
            <div className="text-muted shrink-0 text-right text-xs">
              {d.status_code != null && (
                <span className="font-mono tabular-nums">{d.status_code}</span>
              )}
              {d.duration_ms != null && (
                <span className="ml-2 font-mono tabular-nums">{d.duration_ms}ms</span>
              )}
              {d.attempt > 1 && <span className="ml-2">attempt {d.attempt}</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
