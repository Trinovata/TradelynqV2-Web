# TradeLynq → n8n integration

TradeLynq pushes a **signed webhook** to your own endpoints the moment something
happens in your workspace — an enquiry accepted, a quote sent, a job completed,
an invoice issued. This is the baseline every complex automation builds on: you
cloud-host n8n, subscribe an n8n Webhook node to the events you care about, and
TradeLynq delivers each one to it, signed so your workflow can trust it.

> **Availability.** Outbound webhooks are an **Enterprise** feature. Manage them
> under **Workspace → Integrations**.

---

## How it works

```
 TradeLynq                                   Your n8n
 ─────────                                   ────────
 job completed ──▶ emit event ──▶ dispatcher ──▶ POST (signed) ──▶ Webhook node ──▶ your workflow
                                     │
                                     └─ retries, delivery log, auto-disable
```

1. **You add an endpoint** (your n8n Webhook node's Production URL) and tick the
   events it should receive.
2. **We generate a signing secret**, shown once. You store it in n8n.
3. **When an event fires**, we POST a JSON envelope to your endpoint with an
   `X-TradeLynq-Signature` header (HMAC-SHA256 of the exact body).
4. **Your workflow verifies the signature**, then acts on the payload.

Delivery is best-effort with retries (3 attempts, short backoff). Five
consecutive failed deliveries auto-disable an endpoint so a broken URL can't be
hammered forever — you reactivate it from the Integrations screen once it's
fixed.

---

## 1. Create the n8n Webhook node

In n8n, add a **Webhook** node:

- **HTTP Method:** `POST`
- **Path:** anything, e.g. `tradelynq`
- **Respond:** *Immediately* (return `200` fast; do the work in later nodes)

Activate the workflow and copy the node's **Production URL**, e.g.
`https://n8n.example.com/webhook/tradelynq`.

## 2. Add the endpoint in TradeLynq

**Workspace → Integrations → Add endpoint.** Paste the Production URL (must be
HTTPS), tick the events you want, and create it. **Copy the signing secret now —
it is shown only once.** We store only an encrypted copy and can never display
it again; you can rotate it, but not reveal it.

## 3. Verify the signature in n8n

Add a **Code** node right after the Webhook node. It recomputes the HMAC over the
raw body and rejects anything that doesn't match:

```js
// n8n Code node (Run Once for Each Item). Store the secret in an n8n credential
// or env var — never inline it in a shared workflow.
const crypto = require('crypto')
const secret = $env.TRADELYNQ_WEBHOOK_SECRET // your whsec_… value

const raw = JSON.stringify($json.body)            // the Webhook node exposes the parsed body
const header = $json.headers['x-tradelynq-signature'] // "sha256=<hex>"
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex')

if (header !== expected) {
  throw new Error('Invalid TradeLynq signature — rejecting delivery.')
}
return $json.body
```

> **Signing over the raw body.** The signature is computed over the exact bytes we
> send. If your consumer re-serialises the JSON before hashing (different key
> order or whitespace), the MAC won't match. n8n's Webhook node preserves the
> body, so `JSON.stringify($json.body)` reproduces it faithfully.

## 4. Test it

Back in TradeLynq, press **Test** (the send icon) on the endpoint. We deliver a
`ping` event immediately and show you whether your endpoint answered. The test
appears in the delivery log like any real delivery.

---

## The delivery envelope

Every POST body has this shape:

```json
{
  "id": "b1d9…-uuid",
  "type": "job.completed",
  "created_at": "2026-07-28T14:03:22.114Z",
  "professional_id": "…-uuid",
  "data": { "…": "event-specific, see catalog below" }
}
```

Headers on every delivery:

| Header | Meaning |
| --- | --- |
| `X-TradeLynq-Event` | the event `type`, e.g. `invoice.created` |
| `X-TradeLynq-Delivery` | the delivery `id` — also the **idempotency key**; a retry re-sends the same id, so dedupe on it |
| `X-TradeLynq-Signature` | `sha256=<hex>` HMAC of the raw body |

---

## Event catalog

Names are permanent and payloads only ever grow, so a workflow bound to an event
keeps working. Money is a plain number in **TTD** with an explicit `currency`
field; timestamps are ISO 8601 UTC.

| Event | Fires when | Key `data` fields |
| --- | --- | --- |
| `enquiry.created` | A customer sends you an enquiry | `enquiry_id`, `customer_name`, `description`, `created_at` |
| `enquiry.accepted` | You accept an enquiry | `enquiry_id`, `customer_name`, `accepted_at` |
| `quote.sent` | You send a quote | `quote_id`, `customer_name`, `amount_ttd`, `currency`, `public_url`, `sent_at` |
| `quote.accepted` | A customer accepts a quote | `quote_id`, `customer_name`, `amount_ttd`, `accepted_at` |
| `quote.declined` | A customer declines a quote | `quote_id`, `customer_name`, `declined_at` |
| `job.started` | A job moves into active work | `job_id`, `customer_name`, `title`, `started_at` |
| `job.completed` | You mark a job complete | `job_id`, `customer_name`, `title`, `completed_at` |
| `invoice.created` | You issue an invoice | `invoice_id`, `invoice_number`, `customer_name`, `amount_ttd`, `currency`, `due_date`, `created_at` |
| `invoice.sent` | You send an invoice | `invoice_id`, `invoice_number`, `customer_name`, `amount_ttd`, `sent_at` |
| `invoice.paid` | An invoice is acknowledged paid | `invoice_id`, `invoice_number`, `amount_ttd`, `acknowledged_at` |
| `review.received` | A customer leaves a review | `review_id`, `rating`, `customer_name`, `created_at` |
| `ping` | You press **Test** | `message`, `sent_at` |

The authoritative shapes live in `lib/events/catalog.ts` (Zod schemas). This
table is generated against them — if they ever disagree, the code wins.

---

## Example workflow: WhatsApp on job completion

A common first automation — message the customer for a review when you finish a
job:

1. **Webhook** node — receives the delivery.
2. **Code** node — verify the signature (above).
3. **IF** node — continue only when `type === 'job.completed'`.
4. **HTTP Request** node — call your WhatsApp provider with a message built from
   `data.customer_name` and `data.title`.

Because deliveries carry an idempotency key (`X-TradeLynq-Delivery`), guard
side-effects (a message, an accounting entry) against duplicates by recording the
delivery id and skipping ones you've already processed.

---

## Behaviour reference

- **Retries.** Up to 3 attempts per delivery with short backoff. A `2xx` is
  success; anything else (or a timeout at 10s) is a failure.
- **Auto-disable.** Five consecutive failed *deliveries* disable an endpoint. Fix
  the endpoint, then **Reactivate** — this also resets the failure streak.
- **Pause / resume.** Toggle an endpoint off without deleting it; paused
  endpoints receive nothing.
- **HTTPS only.** Plaintext HTTP endpoints are rejected — deliveries carry
  customer contact details.
- **Delivery log.** The Integrations screen shows recent deliveries with status
  code and duration, for debugging a misbehaving workflow.
