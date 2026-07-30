'use client'

/**
 * Lynq composer (playbook S094).
 *
 * Enter sends, Shift+Enter breaks the line. The character counter renders in
 * mono (numerals are always mono — DESIGN.md). At the session limit the field
 * disables and the note hands off to WhatsApp — the platform's primary
 * support channel.
 */
import { useState, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { motion } from '@/lib/motion'
import { LYNQ_MAX_INPUT_CHARS, lynqSupportHref } from '@/lib/chatbot/prompt'

type ChatInputProps = {
  onSend: (content: string) => void
  /** Session limit reached — input closed for good. */
  disabled?: boolean
  /** A reply is streaming — hold new sends without greying the field. */
  loading?: boolean
}

export function ChatInput({ onSend, disabled, loading }: ChatInputProps) {
  const [value, setValue] = useState('')
  const supportHref = lynqSupportHref()

  const charCount = value.length
  const isOverLimit = charCount > LYNQ_MAX_INPUT_CHARS
  const canSend = value.trim().length > 0 && !isOverLimit && !disabled && !loading

  function handleSend() {
    if (!canSend) return
    onSend(value.trim())
    setValue('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-border bg-card shrink-0 border-t px-3 py-2">
      {disabled && (
        <p className="text-muted mb-1.5 text-center text-xs">
          Session limit reached.{' '}
          {supportHref ? (
            <a
              href={supportHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-ink hover:underline"
            >
              Message us on WhatsApp
            </a>
          ) : (
            'Message us on WhatsApp'
          )}
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Session ended' : 'Ask Lynq anything…'}
          aria-label="Message Lynq"
          disabled={disabled}
          rows={1}
          className={cn(
            'bg-background text-foreground placeholder:text-muted max-h-20 flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none',
            isOverLimit ? 'border-destructive' : 'border-border focus:border-accent',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            motion('press'),
            canSend
              ? 'bg-accent text-accent-foreground hover:bg-accent/90'
              : 'bg-card-subtle text-muted cursor-not-allowed'
          )}
        >
          <Send className="size-4" aria-hidden="true" />
        </button>
      </div>
      {charCount > 0 && (
        <p
          className={cn(
            'mt-1 text-right font-mono text-[10px] tabular-nums',
            isOverLimit ? 'text-destructive' : 'text-muted'
          )}
        >
          {charCount}/{LYNQ_MAX_INPUT_CHARS}
        </p>
      )}
    </div>
  )
}
