'use client'

/**
 * Step 3 — Services & prices (spec `v2/05 §5.2`, copy `copy-professional.md §4.3`).
 *
 * The template chips are the point of this step. A blank "add your services"
 * form gets one vague line; a row of taps that say `General Plumbing Repair`
 * and `Water Heater Installation` gets four specific ones — and specific
 * services are what customers search for and what makes a price filter mean
 * anything. Suggestions come from `profile_templates.suggested_services`, so
 * they are per-category reference data an admin curates, not a hardcoded list.
 *
 * Prices stay optional throughout, in mono. A professional who quotes per job
 * must not be pushed into inventing a number to get past this screen.
 */
import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { useOnboarding } from '../context'
import { StepActions } from '../OnboardingWizard'
import { stepSchemas, type OnboardingService } from '@/lib/professional/onboarding'

export function StepServices() {
  const { draft, update, setStep, categories } = useOnboarding()
  const [showError, setShowError] = React.useState(false)

  const category = categories.find((option) => option.id === draft.categoryId) ?? null
  const named = draft.services.filter((service) => service.name.trim().length > 0)
  const valid = stepSchemas[3].safeParse({ services: named }).success

  const suggestions = (category?.suggestions ?? []).filter(
    (suggestion) =>
      !named.some((service) => service.name.trim().toLowerCase() === suggestion.toLowerCase())
  )

  function setRow(index: number, patch: Partial<OnboardingService>) {
    update({
      services: draft.services.map((service, position) =>
        position === index ? { ...service, ...patch } : service
      ),
    })
  }

  function removeRow(index: number) {
    const removed = draft.services[index]
    const next = draft.services.filter((_, position) => position !== index)
    // Never leave the list empty — an empty list has no affordance to type into.
    update({ services: next.length > 0 ? next : [{ name: '' }] })
    if (removed?.name.trim()) {
      toast('Service removed.', {
        action: {
          label: 'Undo',
          onClick: () =>
            update({
              services: [...next.filter((service) => service.name.trim()), removed],
            }),
        },
      })
    }
  }

  function addSuggestion(name: string) {
    // Reuse the trailing blank row rather than appending below it, so tapping
    // three chips does not leave three empty rows interleaved.
    const blankIndex = draft.services.findIndex((service) => !service.name.trim())
    if (blankIndex >= 0) setRow(blankIndex, { name })
    else update({ services: [...draft.services, { name }] })
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-md text-foreground">What do you offer?</h1>
        <p className="text-muted text-sm">
          Add what you offer. Prices are optional — you can quote per job instead.
        </p>
      </header>

      {suggestions.length > 0 && category && (
        <div className="flex flex-col gap-2">
          <p className="text-muted text-xs">Popular in {category.name} — tap to add:</p>
          <ul className="flex flex-wrap gap-2">
            {suggestions.slice(0, 8).map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => addSuggestion(suggestion)}
                  className="border-border bg-card text-body hover:border-accent hover:text-accent-ink focus-visible:outline-ring rounded-full border px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <Plus className="mr-1 inline size-3.5" aria-hidden="true" />
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="flex flex-col gap-4">
        {draft.services.map((service, index) => (
          <li
            key={index}
            className="border-border bg-card flex flex-col gap-3 rounded-[--radius-control] border p-3"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  label={index === 0 ? 'Service' : undefined}
                  aria-label={`Service ${index + 1}`}
                  placeholder="General plumbing repair"
                  value={service.name}
                  maxLength={60}
                  onChange={(event) => setRow(index, { name: event.target.value })}
                />
              </div>
              <div className="w-32">
                <Input
                  label={index === 0 ? 'Price (optional)' : undefined}
                  aria-label={`Service ${index + 1} price in TTD`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="TTD"
                  className="font-mono tabular-nums"
                  value={service.price_ttd ?? ''}
                  onChange={(event) =>
                    setRow(index, {
                      price_ttd: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(index)}
                aria-label={`Remove service ${index + 1}`}
                className="text-muted hover:text-destructive mt-0.5 shrink-0 p-2 sm:mt-7"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>

            <Input
              aria-label={`Service ${index + 1} details`}
              placeholder="What’s included, how long it takes"
              value={service.description ?? ''}
              maxLength={200}
              onChange={(event) => setRow(index, { description: event.target.value || undefined })}
            />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => update({ services: [...draft.services, { name: '' }] })}
        className="text-accent-ink inline-flex items-center gap-1 self-start text-sm"
      >
        <Plus className="size-4" aria-hidden="true" />
        Add another service
      </button>

      {showError && !valid && (
        <p role="alert" className="text-destructive text-sm">
          Add at least one service to continue.
        </p>
      )}

      <StepActions
        forwardLabel="Continue"
        onForward={() => {
          if (!valid) {
            setShowError(true)
            return
          }
          setStep(4)
        }}
      />
    </section>
  )
}
