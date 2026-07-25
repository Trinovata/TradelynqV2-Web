'use client'

/**
 * useChatbot — Lynq's client state (playbook S094).
 *
 * V2 port of V1's `hooks/useChatbot.ts`, adapted from JSON replies to the
 * streaming contract: the route answers with a plain-text stream whose raw
 * text may carry `[ACTION:x]` tags. Chunks append incrementally; complete
 * tags are stripped as they settle, and a chunk boundary that lands MID-tag
 * is held back so half a tag never flashes into the transcript.
 *
 * The greeting is local furniture — it is never sent to the API. The session
 * cap (20 user messages) is enforced here; the route's zod cap is the wire
 * backstop, and only the last 10 messages are forwarded either way.
 */
import { useState, useCallback, useRef } from 'react'
import {
  LYNQ_GREETING,
  LYNQ_MAX_ASSISTANT_CHARS,
  LYNQ_MAX_MESSAGES,
  LYNQ_SESSION_LIMIT_MESSAGE,
  LYNQ_ERROR_MESSAGE,
  LYNQ_ACTION_TAG,
  LYNQ_PARTIAL_ACTION_TAG,
  parseLynqActions,
  type LynqAction,
} from '@/lib/chatbot/prompt'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: LynqAction[]
}

/** How many messages the hook forwards — mirrors the route's window. */
const HISTORY_WINDOW = 10

let messageIdCounter = 0
function nextId(): string {
  messageIdCounter += 1
  return `lynq-${messageIdCounter}`
}

/** Display text for an in-flight stream: complete tags out, partial tail held. */
function displayText(raw: string): string {
  return raw.replace(LYNQ_ACTION_TAG, '').replace(LYNQ_PARTIAL_ACTION_TAG, '').trimStart()
}

export function useChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: nextId(), role: 'assistant', content: LYNQ_GREETING },
  ])
  const [loading, setLoading] = useState(false)
  const userMessageCountRef = useRef(0)

  const isAtLimit = userMessageCountRef.current >= LYNQ_MAX_MESSAGES

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || loading) return

      if (userMessageCountRef.current >= LYNQ_MAX_MESSAGES) {
        setMessages((previous) => [
          ...previous,
          {
            id: nextId(),
            role: 'assistant',
            content: LYNQ_SESSION_LIMIT_MESSAGE,
            actions: ['contact'],
          },
        ])
        return
      }
      userMessageCountRef.current += 1

      const userMessage: ChatMessage = { id: nextId(), role: 'user', content: trimmed }
      setMessages((previous) => [...previous, userMessage])
      setLoading(true)

      try {
        // Greeting excluded; only the recent window travels. Assistant turns
        // are clamped to the wire cap so an unusually long reply can never make
        // the NEXT send fail validation — user turns pass through untouched
        // (truncating a person's words would change what they asked).
        const payload = [...messages.slice(1), userMessage]
          .filter((message) => message.content.trim().length > 0)
          .slice(-HISTORY_WINDOW)
          .map((message) => ({
            role: message.role,
            content:
              message.role === 'assistant'
                ? message.content.slice(0, LYNQ_MAX_ASSISTANT_CHARS)
                : message.content,
          }))

        const response = await fetch('/api/chatbot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: payload }),
        })

        if (!response.ok || !response.body) {
          throw new Error(`chatbot request failed: ${response.status}`)
        }

        const assistantId = nextId()
        setMessages((previous) => [
          ...previous,
          { id: assistantId, role: 'assistant', content: '' },
        ])
        // First chunk replaces the typing indicator with real text.
        setLoading(false)

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let rawText = ''

        const update = (content: string, actions?: LynqAction[]) => {
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantId ? { ...message, content, actions } : message
            )
          )
        }

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          rawText += decoder.decode(value, { stream: true })
          update(displayText(rawText))
        }
        rawText += decoder.decode()

        const { text, actions } = parseLynqActions(rawText)
        update(text || LYNQ_ERROR_MESSAGE, actions)
      } catch {
        setLoading(false)
        setMessages((previous) => [
          ...previous,
          { id: nextId(), role: 'assistant', content: LYNQ_ERROR_MESSAGE },
        ])
      } finally {
        setLoading(false)
      }
    },
    [messages, loading]
  )

  return { messages, loading, sendMessage, isAtLimit }
}
