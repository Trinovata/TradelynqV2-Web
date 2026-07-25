/**
 * POST /api/chatbot — Lynq (playbook S094, pack api-commerce-public §6).
 *
 * Public route, so the canon order is what remains of the ladder:
 * rate-limit → zod. No auth, no legal gate — a signed-out visitor asking about
 * pricing is exactly who this exists for.
 *
 * ## One response shape, two sources
 *
 * The pack specifies STREAMING text with inline `[ACTION:x]` tags. Both the
 * live Anthropic path and the no-key static fallback answer through the same
 * shape — a `text/plain` stream whose raw text may carry action tags that the
 * client strips. The fallback is a single-chunk stream, so the client has
 * exactly one code path and the no-key branch (the only one verifiable before
 * S004 provisions a key) exercises the real pipeline end to end.
 *
 * `X-Lynq-Mode: fallback | live` lets tests assert which branch answered
 * without ever reading env values.
 *
 * FLAG (S094): the live path is code-complete but unverifiable until S004
 * provisions ANTHROPIC_API_KEY. The task brief asked for "low temperature" —
 * claude-sonnet-5 rejects non-default sampling parameters (400), so no
 * temperature is sent; determinism comes from the prompt. Thinking is
 * explicitly disabled: a 300-token chat reply gains nothing from adaptive
 * thinking and the token budget is too small to share with it.
 */
import { z } from 'zod'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import {
  LYNQ_SYSTEM_PROMPT,
  LYNQ_FALLBACK,
  LYNQ_MAX_MESSAGES,
  LYNQ_MAX_INPUT_CHARS,
} from '@/lib/chatbot/prompt'

const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 300
/** Only the last N messages are forwarded upstream — cost control, not context. */
const HISTORY_WINDOW = 10

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(LYNQ_MAX_INPUT_CHARS),
      })
    )
    .min(1)
    .max(LYNQ_MAX_MESSAGES),
})

/** Wraps text (or a live stream) in the one response shape the client reads. */
function streamResponse(stream: ReadableStream<Uint8Array>, mode: 'fallback' | 'live'): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Lynq-Mode': mode,
    },
  })
}

/** The static fallback as a single-chunk stream, trailing a contact action. */
function fallbackResponse(): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`${LYNQ_FALLBACK} [ACTION:contact]`))
      controller.close()
    },
  })
  return streamResponse(stream, 'fallback')
}

/**
 * Pipes Anthropic's SSE stream into a plain text stream. Only
 * `content_block_delta` / `text_delta` events carry text; everything else
 * (message_start, message_delta, pings) is dropped. Action tags pass through
 * raw — stripping is the client's job, which keeps this transform stateless.
 */
function pipeAnthropicSse(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''

  return upstream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true })
        const lines = buffer.split('\n')
        // The last element may be a partial line — keep it for the next chunk.
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (!payload || payload === '[DONE]') continue
          try {
            const event = JSON.parse(payload) as {
              type?: string
              delta?: { type?: string; text?: string }
            }
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              if (event.delta.text) controller.enqueue(encoder.encode(event.delta.text))
            }
          } catch {
            // A malformed frame is dropped, never fatal — the stream continues.
          }
        }
      },
    })
  )
}

export async function POST(request: Request) {
  const limit = await checkRateLimit('chatbot', identifierFrom(request))
  if (!limit.ok) return limit.response

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return err('INVALID_INPUT', { fieldErrors: {}, formErrors: ['Send a JSON body.'] })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return err('INVALID_INPUT', { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors })
  }

  // Env NAME from .env.example; the value is never read from any file.
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return fallbackResponse()

  const recent = parsed.data.messages.slice(-HISTORY_WINDOW)

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        stream: true,
        // Disabled, not adaptive: a short chat reply cannot spare its token
        // budget for thinking, and latency is the product here.
        thinking: { type: 'disabled' },
        system: LYNQ_SYSTEM_PROMPT,
        messages: recent.map((message) => ({ role: message.role, content: message.content })),
      }),
    })

    if (!upstream.ok || !upstream.body) {
      logger.error('chatbot:upstream_error', { status: upstream.status })
      return fallbackResponse()
    }

    return streamResponse(pipeAnthropicSse(upstream.body), 'live')
  } catch (error) {
    logger.error('chatbot:request_failed', { error: String(error) })
    return fallbackResponse()
  }
}
