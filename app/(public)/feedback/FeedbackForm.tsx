'use client'

/**
 * Feedback form (deck §11.5 — labels, placeholders, and the required-field
 * error verbatim). Success replaces the form with an acknowledgement rather
 * than clearing it silently — a vanished form reads as a glitch.
 */
import * as React from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'

type State =
  { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string }

export function FeedbackForm() {
  const [state, setState] = React.useState<State>({ kind: 'idle' })
  const [message, setMessage] = React.useState('')
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [fieldError, setFieldError] = React.useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!message.trim()) {
      setFieldError('Add a message so we know how to help.')
      return
    }
    setFieldError(null)
    setState({ kind: 'sending' })
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          name: name.trim() || undefined,
          email: email.trim() || undefined,
        }),
      })
      if (res.ok) {
        setState({ kind: 'sent' })
      } else {
        setState({ kind: 'error', message: 'That didn’t send. Try again in a moment.' })
      }
    } catch {
      setState({ kind: 'error', message: 'Check your connection and try again.' })
    }
  }

  if (state.kind === 'sent') {
    return (
      <p className="text-body text-sm">
        Thanks — we read every message. If you left an email, we&rsquo;ll reply if there&rsquo;s
        anything to add.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Input
        label="Your name (optional)"
        placeholder="Maria Gonzalez"
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="name"
      />
      <Input
        label="Email (optional)"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
      />
      <Textarea
        label="What's on your mind?"
        placeholder="Describe the bug or idea in as much detail as you like."
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={6}
        error={fieldError ?? undefined}
        required
      />
      {state.kind === 'error' && <p className="text-destructive text-sm">{state.message}</p>}
      <div>
        <Button type="submit" isLoading={state.kind === 'sending'} loadingLabel="Sending…">
          Send feedback
        </Button>
      </div>
    </form>
  )
}
