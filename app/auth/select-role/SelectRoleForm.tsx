'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AUTH_COPY } from '@/lib/copy/auth'
import { safeNextPath } from '@/lib/routes'
import { cn } from '@/lib/utils/cn'

const copy = AUTH_COPY.selectRole

type RoleChoice = 'customer' | 'professional'
type Subtype = (typeof copy.subtypes)[number]['id']

export function SelectRoleForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [role, setRole] = React.useState<RoleChoice | null>(null)
  const [subtype, setSubtype] = React.useState<Subtype | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // A professional must choose a subtype; a customer must not have one.
  const canContinue = role === 'customer' || (role === 'professional' && subtype !== null)

  async function onContinue() {
    if (!role || !canContinue) return

    setSubmitting(true)
    setError(null)

    const response = await fetch('/api/auth/assign-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role,
        ...(role === 'professional' ? { subtype } : {}),
      }),
    })

    const body = (await response.json().catch(() => null)) as {
      data?: { redirectTo?: string }
      error?: string
    } | null

    if (!response.ok) {
      // The server's `error` string is already user-facing copy from the
      // taxonomy — the API is responsible for that, not this component.
      setError(body?.error ?? 'Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    const fallback = body?.data?.redirectTo ?? '/'
    router.push(safeNextPath(searchParams.get('next'), fallback))
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-display-lg text-foreground">{copy.heading}</h1>
        <p className="text-muted">{copy.sub}</p>
      </header>

      {error && (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive rounded-[--radius-control] p-3 text-sm"
        >
          {error}
        </p>
      )}

      <div role="radiogroup" aria-label={copy.heading} className="grid gap-4 sm:grid-cols-2">
        <RoleCard
          icon={Users}
          title={copy.customerTitle}
          body={copy.customerBody}
          selected={role === 'customer'}
          onSelect={() => {
            setRole('customer')
            // Clearing the subtype matters: switching to customer with a stale
            // subtype would send an invalid combination the API rejects.
            setSubtype(null)
          }}
        />
        <RoleCard
          icon={Briefcase}
          title={copy.professionalTitle}
          body={copy.professionalBody}
          selected={role === 'professional'}
          onSelect={() => setRole('professional')}
        />
      </div>

      {role === 'professional' && (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-foreground pb-2 text-sm font-medium">
            Which describes you best?
          </legend>
          <div className="grid gap-3">
            {copy.subtypes.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={subtype === option.id}
                onClick={() => setSubtype(option.id)}
                className={cn(
                  'flex flex-col gap-0.5 rounded-[--radius-control] border p-4 text-left',
                  'transition-transform duration-75 ease-out active:scale-[0.99]',
                  'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                  subtype === option.id
                    ? 'border-accent bg-accent-soft'
                    : 'border-border bg-card hover:bg-card-subtle'
                )}
              >
                <span className="text-foreground font-medium">{option.title}</span>
                <span className="text-muted text-sm">{option.body}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          disabled={!canContinue}
          isLoading={submitting}
          onClick={onContinue}
          className="sm:self-start"
        >
          {copy.continue}
        </Button>
        <p className="text-muted text-xs">{copy.changeLaterNote}</p>
      </div>
    </div>
  )
}

function RoleCard({
  icon: Icon,
  title,
  body,
  selected,
  onSelect,
}: {
  icon: typeof Users
  title: string
  body: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex flex-col items-start gap-2 rounded-[--radius-card] border p-6 text-left',
        'transition-[transform,box-shadow] duration-150 ease-out',
        'hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.99]',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        selected ? 'border-accent bg-accent-soft' : 'border-border bg-card'
      )}
    >
      <Icon className="text-muted size-6" aria-hidden="true" />
      <span className="text-display-sm text-foreground">{title}</span>
      <span className="text-muted text-sm">{body}</span>
    </button>
  )
}
