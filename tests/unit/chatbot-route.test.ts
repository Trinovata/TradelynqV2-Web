/**
 * POST /api/chatbot — Lynq (playbook S094, pack api-commerce-public §6).
 *
 * The properties under test are the route contract: rate-limit before zod,
 * the zod caps (20 messages, 500 chars), and the ONE response shape — a
 * text/plain stream — answered by either branch. The no-key static fallback
 * is the branch that must demonstrably work before S004 provisions a key, so
 * it gets the closest scrutiny; the live path is tested against a mocked
 * Anthropic SSE stream (window slicing, text_delta assembly, upstream-failure
 * degradation to the fallback).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'

const { checkRateLimitMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
  identifierFrom: () => 'ip:127.0.0.1',
}))
vi.mock('@/lib/utils/logger', () => ({
  logger: { debug() {}, info() {}, warn() {}, error() {} },
  logSampled() {},
}))

import { POST } from '@/app/api/chatbot/route'
import { LYNQ_FALLBACK } from '@/lib/chatbot/prompt'

function chatRequest(body: unknown) {
  return new Request('http://localhost/api/chatbot', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function messagesOf(count: number, content = 'Hello Lynq') {
  return Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `${content} ${index}`,
  }))
}

/** An Anthropic-shaped SSE body carrying the given text deltas. */
function sseStream(deltas: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const frames = [
    'event: message_start\ndata: {"type":"message_start"}\n',
    ...deltas.map(
      (text) =>
        `event: content_block_delta\ndata: ${JSON.stringify({
          type: 'content_block_delta',
          delta: { type: 'text_delta', text },
        })}\n`
    ),
    'event: message_stop\ndata: {"type":"message_stop"}\n',
  ]
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame))
      controller.close()
    },
  })
}

describe('POST /api/chatbot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockResolvedValue({ ok: true, remaining: 9, degraded: false })
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns the limiter response verbatim when rate limited — before validation', async () => {
    checkRateLimitMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        {
          code: 'RATE_LIMITED',
          error: 'Too many requests. Please try again shortly.',
          details: { retryAfterSeconds: 30, limiter: 'chatbot' },
        },
        { status: 429, headers: { 'Retry-After': '30' } }
      ),
    })
    // Deliberately invalid body: the limiter must answer first (canon order).
    const res = await POST(chatRequest({ nonsense: true }))
    const body = await res.json()
    expect(res.status).toBe(429)
    expect(body.details).toEqual({ retryAfterSeconds: 30, limiter: 'chatbot' })
  })

  it('refuses a non-JSON body with 422 INVALID_INPUT', async () => {
    const res = await POST(
      new Request('http://localhost/api/chatbot', { method: 'POST', body: 'not json' })
    )
    const body = await res.json()
    expect(res.status).toBe(422)
    expect(body.code).toBe('INVALID_INPUT')
  })

  it('caps the conversation at 20 messages on the wire', async () => {
    const res = await POST(chatRequest({ messages: messagesOf(21) }))
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('INVALID_INPUT')
  })

  it('caps a single message at 500 characters', async () => {
    const res = await POST(chatRequest({ messages: [{ role: 'user', content: 'x'.repeat(501) }] }))
    expect(res.status).toBe(422)
  })

  it('rejects an unknown role at the schema', async () => {
    const res = await POST(chatRequest({ messages: [{ role: 'system', content: 'hi' }] }))
    expect(res.status).toBe(422)
  })

  it('streams the static fallback with the contact tag when no key is configured', async () => {
    const res = await POST(
      chatRequest({ messages: [{ role: 'user', content: 'What is pricing?' }] })
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(res.headers.get('x-lynq-mode')).toBe('fallback')
    const text = await res.text()
    expect(text).toContain(LYNQ_FALLBACK)
    expect(text).toContain('[ACTION:contact]')
  })

  it('streams assembled text_delta chunks from the live path, forwarding only the last 10', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')
    const fetchMock = vi.fn(async () => new Response(sseStream(['Hello', ' from', ' Lynq'])))
    vi.stubGlobal('fetch', fetchMock)

    const res = await POST(chatRequest({ messages: messagesOf(14) }))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-lynq-mode')).toBe('live')
    expect(await res.text()).toBe('Hello from Lynq')

    const upstreamBody = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body
    )
    expect(upstreamBody.model).toBe('claude-sonnet-5')
    expect(upstreamBody.stream).toBe(true)
    expect(upstreamBody.messages).toHaveLength(10)
    // The window keeps the TAIL of the conversation.
    expect(upstreamBody.messages[9].content).toBe('Hello Lynq 13')
  })

  it('degrades to the fallback stream when the upstream answers non-200', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('overloaded', { status: 529 }))
    )

    const res = await POST(chatRequest({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-lynq-mode')).toBe('fallback')
    expect(await res.text()).toContain(LYNQ_FALLBACK)
  })

  it('degrades to the fallback stream when the upstream fetch throws', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      })
    )

    const res = await POST(chatRequest({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-lynq-mode')).toBe('fallback')
    expect(await res.text()).toContain(LYNQ_FALLBACK)
  })
})
