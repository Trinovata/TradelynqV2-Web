'use client'

/**
 * Lynq transcript (playbook S094).
 *
 * Bubbles: user turns are ink-on-paper inverted (`bg-foreground`), assistant
 * turns sit on `bg-card-subtle`. Action chips render under an assistant turn
 * and navigate — internal routes via Link, the contact action via the support
 * `wa.me` link. The typing indicator is the loading state (M7 pulse); it shows
 * only until the first streamed chunk lands.
 */
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { motion } from '@/lib/motion'
import { lynqSupportHref, type LynqAction } from '@/lib/chatbot/prompt'
import type { ChatMessage } from '@/hooks/use-chatbot'

const ACTION_LINKS: Record<Exclude<LynqAction, 'contact'>, { label: string; href: string }> = {
  pricing: { label: 'View pricing', href: '/pricing' },
  catalogue: { label: 'Browse the catalogue', href: '/catalogue' },
  search: { label: 'Search professionals', href: '/search' },
  signup: { label: 'Sign up', href: '/signup' },
}

const chipClassName = cn(
  'bg-accent-soft text-accent-ink inline-block rounded-full px-2.5 py-1 text-xs font-medium',
  motion('press')
)

function ActionChips({ actions }: { actions: LynqAction[] }) {
  const supportHref = lynqSupportHref()
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {actions.map((action) => {
        if (action === 'contact') {
          if (!supportHref) return null
          return (
            <a
              key={action}
              href={supportHref}
              target="_blank"
              rel="noopener noreferrer"
              className={chipClassName}
            >
              Chat on WhatsApp
            </a>
          )
        }
        const link = ACTION_LINKS[action]
        return (
          <Link key={action} href={link.href} className={chipClassName}>
            {link.label}
          </Link>
        )
      })}
    </div>
  )
}

type MessageListProps = {
  messages: ChatMessage[]
  loading: boolean
}

export function MessageList({ messages, loading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Follow the newest content — including mid-stream growth of the last bubble.
  const lastContentLength = messages[messages.length - 1]?.content.length ?? 0
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, lastContentLength, loading])

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
      {messages.map((message) => {
        const isUser = message.role === 'user'
        return (
          <div key={message.id} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                isUser
                  ? 'bg-foreground text-background rounded-br-md'
                  : 'bg-card-subtle text-body border-border rounded-bl-md border'
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {!isUser && message.actions && message.actions.length > 0 && (
                <ActionChips actions={message.actions} />
              )}
            </div>
          </div>
        )
      })}

      {loading && (
        <div className="flex justify-start">
          <div className="bg-card-subtle border-border rounded-2xl rounded-bl-md border px-4 py-3">
            <div className="flex gap-1" aria-label="Lynq is typing">
              <span className="bg-muted size-1.5 animate-pulse rounded-full" />
              <span
                className="bg-muted size-1.5 animate-pulse rounded-full"
                style={{ animationDelay: '200ms' }}
              />
              <span
                className="bg-muted size-1.5 animate-pulse rounded-full"
                style={{ animationDelay: '400ms' }}
              />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
