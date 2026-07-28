import { z } from 'zod'

/**
 * The event catalog — the platform's integration contract (playbook S116).
 *
 * This is the single, stable surface an external automation (n8n, Zapier, a bare
 * webhook consumer) binds to. Every outbound webhook TradeLynq sends is one of
 * these events, wrapped in the envelope below. The rules that make it a
 * *contract* rather than an implementation detail:
 *
 * 1. **Event names are permanent.** `job.completed` means the same thing forever.
 *    Renaming one silently breaks every workflow subscribed to it, with no
 *    compile error on the subscriber's side — so names are append-only.
 * 2. **Payloads only grow.** Adding a field is safe (consumers ignore unknowns);
 *    removing or renaming one is a breaking change. New required data → new field.
 * 3. **The schema IS the documentation.** `docs/integrations/n8n.md` is generated
 *    against these Zod shapes, so the doc can never drift from what actually ships.
 *
 * This module is deliberately isomorphic — pure data and types, no secrets, no
 * `server-only`. The integrations UI imports it to list subscribable events; the
 * dispatcher imports it to validate a payload before signing it. One source.
 *
 * Money is carried as a plain number in TTD (the platform's only settlement
 * currency) plus an explicit `currency` discriminator, so a consumer never has
 * to parse `TTD $1,200` out of a display string. Timestamps are ISO 8601 UTC.
 */

// ── Groups (how the UI clusters the event picker) ────────────────────────────

export const EVENT_GROUPS = ['enquiries', 'quotes', 'jobs', 'invoices', 'reviews', 'system'] as const
export type EventGroup = (typeof EVENT_GROUPS)[number]

// ── Shared fragments ─────────────────────────────────────────────────────────

const money = { amount_ttd: z.number().nonnegative(), currency: z.literal('TTD') }

// ── The registry: one entry per event, schema + human metadata ───────────────

type EventDef = {
  group: EventGroup
  /** Shown in the event picker. */
  label: string
  /** One line explaining when it fires — shown under the label and in the docs. */
  description: string
  /** The `data` payload shape. Consumers receive this inside the envelope. */
  schema: z.ZodType
}

/**
 * Adding an event: append an entry. Never rename or delete one that has shipped —
 * a live workflow may depend on the name. `satisfies` keeps every entry honest
 * against `EventDef` while preserving the literal keys for the type derivations
 * below.
 */
export const EVENT_REGISTRY = {
  'enquiry.created': {
    group: 'enquiries',
    label: 'Enquiry received',
    description: 'A customer sent you a new enquiry.',
    schema: z.object({
      enquiry_id: z.string().uuid(),
      customer_name: z.string(),
      description: z.string(),
      category: z.string().nullable().optional(),
      created_at: z.string(),
    }),
  },
  'enquiry.accepted': {
    group: 'enquiries',
    label: 'Enquiry accepted',
    description: 'You accepted an enquiry and opened a conversation.',
    schema: z.object({
      enquiry_id: z.string().uuid(),
      customer_name: z.string(),
      accepted_at: z.string(),
    }),
  },
  'quote.sent': {
    group: 'quotes',
    label: 'Quote sent',
    description: 'You sent a quote to a customer.',
    schema: z.object({
      quote_id: z.string().uuid(),
      enquiry_id: z.string().uuid().nullable().optional(),
      customer_name: z.string(),
      ...money,
      public_url: z.string().nullable().optional(),
      sent_at: z.string(),
    }),
  },
  'quote.accepted': {
    group: 'quotes',
    label: 'Quote accepted',
    description: 'A customer accepted a quote you sent.',
    schema: z.object({
      quote_id: z.string().uuid(),
      customer_name: z.string(),
      ...money,
      accepted_at: z.string(),
    }),
  },
  'quote.declined': {
    group: 'quotes',
    label: 'Quote declined',
    description: 'A customer declined a quote you sent.',
    schema: z.object({
      quote_id: z.string().uuid(),
      customer_name: z.string(),
      declined_at: z.string(),
    }),
  },
  'job.started': {
    group: 'jobs',
    label: 'Job started',
    description: 'A job moved into active work.',
    schema: z.object({
      job_id: z.string().uuid(),
      customer_name: z.string(),
      title: z.string().nullable().optional(),
      started_at: z.string(),
    }),
  },
  'job.completed': {
    group: 'jobs',
    label: 'Job completed',
    description: 'You marked a job complete.',
    schema: z.object({
      job_id: z.string().uuid(),
      customer_name: z.string(),
      title: z.string().nullable().optional(),
      completed_at: z.string(),
    }),
  },
  'invoice.created': {
    group: 'invoices',
    label: 'Invoice created',
    description: 'You issued a new invoice.',
    schema: z.object({
      invoice_id: z.string().uuid(),
      invoice_number: z.string(),
      customer_name: z.string(),
      ...money,
      due_date: z.string().nullable().optional(),
      created_at: z.string(),
    }),
  },
  'invoice.sent': {
    group: 'invoices',
    label: 'Invoice sent',
    description: 'You sent an invoice to a customer.',
    schema: z.object({
      invoice_id: z.string().uuid(),
      invoice_number: z.string(),
      customer_name: z.string(),
      ...money,
      sent_at: z.string(),
    }),
  },
  'invoice.paid': {
    group: 'invoices',
    label: 'Invoice acknowledged paid',
    description: 'An invoice was acknowledged as paid.',
    schema: z.object({
      invoice_id: z.string().uuid(),
      invoice_number: z.string(),
      ...money,
      acknowledged_at: z.string(),
    }),
  },
  'review.received': {
    group: 'reviews',
    label: 'Review received',
    description: 'A customer left you a review.',
    schema: z.object({
      review_id: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      customer_name: z.string().nullable().optional(),
      created_at: z.string(),
    }),
  },
  'ping': {
    group: 'system',
    label: 'Test ping',
    description: 'A manual test event sent from the integrations screen.',
    schema: z.object({
      message: z.string(),
      sent_at: z.string(),
    }),
  },
} satisfies Record<string, EventDef>

// ── Derived types ────────────────────────────────────────────────────────────

export type EventType = keyof typeof EVENT_REGISTRY

/** Every event name, as an array — for the UI picker and zod enums. */
export const EVENT_TYPES = Object.keys(EVENT_REGISTRY) as [EventType, ...EventType[]]

/** The `data` payload for a given event, inferred from its schema. */
export type EventData<T extends EventType> = z.infer<(typeof EVENT_REGISTRY)[T]['schema']>

/**
 * A discriminated union of everything `emitEvent` will accept. The `type` narrows
 * `data` to exactly that event's payload, so a mismatched field is a compile
 * error at the call site — the tool route can't emit a malformed `job.completed`.
 */
export type EventInput = {
  [K in EventType]: { type: K; data: EventData<K> }
}[EventType]

// ── The envelope (what a subscriber actually receives) ───────────────────────

/**
 * The wire shape of every delivery. `id` is the delivery id (also the
 * idempotency key — a retry re-sends the same id, so a consumer can dedupe), and
 * it is echoed in the `X-TradeLynq-Delivery` header.
 */
export type EventEnvelope<T extends EventType = EventType> = {
  id: string
  type: T
  created_at: string
  professional_id: string
  data: EventData<T>
}

export const envelopeSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(EVENT_TYPES),
  created_at: z.string(),
  professional_id: z.string().uuid(),
  data: z.record(z.string(), z.unknown()),
})

// ── Lookups the UI and docs share ────────────────────────────────────────────

export type EventSummary = { type: EventType; label: string; description: string }

/** Subscribable events, grouped, in catalogue order — drives the UI picker. */
export function eventsByGroup(): Record<EventGroup, EventSummary[]> {
  const out = {
    enquiries: [],
    quotes: [],
    jobs: [],
    invoices: [],
    reviews: [],
    system: [],
  } as Record<EventGroup, EventSummary[]>
  for (const type of EVENT_TYPES) {
    const def = EVENT_REGISTRY[type]
    out[def.group].push({ type, label: def.label, description: def.description })
  }
  return out
}

/** True if `type` is a known event — guards untrusted input from config rows. */
export function isEventType(type: string): type is EventType {
  return Object.hasOwn(EVENT_REGISTRY, type)
}
