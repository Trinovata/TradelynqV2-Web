'use client'

/**
 * Lynq launcher + panel (playbook S094).
 *
 * Mounted in `app/(public)/layout.tsx` only — public surfaces get the widget,
 * dashboards do not, by placement rather than a pathname blocklist (V1 kept an
 * EXCLUDED_PREFIXES list that had to chase every new dashboard route).
 *
 * Presentation follows Modal's split: below 768px the panel is a bottom Sheet
 * (M6 for free, drag-to-dismiss, safe-area padding); above it, a floating card
 * anchored bottom-right (M5 enter). The viewport is sampled when the launcher
 * is pressed — always after hydration, so the server/client render never
 * disagrees. Chat state lives HERE, not in the window, so closing and
 * reopening the panel keeps the conversation (V1 lost it on every close).
 */
import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { motion } from '@/lib/motion'
import { cn } from '@/lib/utils/cn'
import { useChatbot } from '@/hooks/use-chatbot'
import { ChatWindow } from './chat-window'

/** Same boundary as Modal's sheet delegation — `.98` avoids a 768px dead zone. */
const SHEET_QUERY = '(max-width: 767.98px)'

export function ChatbotWidget() {
  const [open, setOpen] = useState(false)
  const [asSheet, setAsSheet] = useState(false)
  const { messages, loading, sendMessage, isAtLimit } = useChatbot()

  function toggle() {
    if (!open) setAsSheet(window.matchMedia(SHEET_QUERY).matches)
    setOpen((previous) => !previous)
  }

  return (
    <>
      {open &&
        (asSheet ? (
          <Sheet open={open} onOpenChange={setOpen} title="Lynq" height="auto">
            <ChatWindow
              variant="sheet"
              messages={messages}
              loading={loading}
              isAtLimit={isAtLimit}
              onSend={sendMessage}
            />
          </Sheet>
        ) : (
          <ChatWindow
            variant="floating"
            messages={messages}
            loading={loading}
            isAtLimit={isAtLimit}
            onSend={sendMessage}
            onClose={() => setOpen(false)}
          />
        ))}

      <button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Close chat with Lynq' : 'Open chat with Lynq'}
        aria-expanded={open}
        className={cn(
          'bg-foreground text-background fixed right-4 bottom-20 z-40 flex size-12 items-center justify-center rounded-full shadow-lg md:right-6 md:bottom-6',
          motion('press')
        )}
      >
        {open ? (
          <X className="size-5" aria-hidden="true" />
        ) : (
          <MessageCircle className="size-5" aria-hidden="true" />
        )}
      </button>
    </>
  )
}
