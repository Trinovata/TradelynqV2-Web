'use client'

/**
 * Lynq chat window (playbook S094).
 *
 * Two presentations, one body: `floating` renders the full desktop card
 * (header + close, M5 enter); `sheet` renders only the column — the Sheet
 * primitive already supplies chrome, title, and dismissal.
 */
import { X } from 'lucide-react'
import { MOTION } from '@/lib/motion'
import { cn } from '@/lib/utils/cn'
import type { ChatMessage } from '@/hooks/use-chatbot'
import { MessageList } from './message-list'
import { ChatInput } from './chat-input'

type ChatWindowProps = {
  variant: 'floating' | 'sheet'
  messages: ChatMessage[]
  loading: boolean
  isAtLimit: boolean
  onSend: (content: string) => void
  /** Floating only — the sheet closes itself. */
  onClose?: () => void
}

export function ChatWindow({
  variant,
  messages,
  loading,
  isAtLimit,
  onSend,
  onClose,
}: ChatWindowProps) {
  const body = (
    <>
      <MessageList messages={messages} loading={loading} />
      <ChatInput onSend={onSend} disabled={isAtLimit} loading={loading} />
    </>
  )

  if (variant === 'sheet') {
    return <div className="flex h-[60dvh] flex-col">{body}</div>
  }

  return (
    <div
      role="dialog"
      aria-label="Lynq — TradeLynq assistant"
      className={cn(
        'bg-card border-border fixed right-4 bottom-[5.5rem] z-50 flex h-[520px] max-h-[70dvh] w-[calc(100vw-2rem)] max-w-[360px] flex-col overflow-hidden rounded-2xl border shadow-xl md:right-6 md:bottom-22',
        // M5 enter: @starting-style (Tailwind `starting:`) animates insertion
        // with no state — the panel rises and fades in as it mounts.
        MOTION.modal.className,
        'starting:translate-y-2 starting:opacity-0'
      )}
    >
      <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-foreground text-sm font-semibold">Lynq</p>
          <p className="text-muted text-xs">TradeLynq assistant</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="text-muted hover:text-foreground flex size-7 items-center justify-center rounded-lg transition-transform duration-75 ease-out active:scale-[0.98]"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {body}
    </div>
  )
}
