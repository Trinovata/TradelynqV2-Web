'use client'

/**
 * `Draft my bio` (playbook S107, copy `copy-professional.md §4.2`).
 *
 * Three options from a few keywords, each independently usable or regenerable.
 * Three rather than one on purpose: a single suggestion invites "accept or
 * reject", three invite "this one, but I'd change the middle sentence" — which
 * is the outcome that produces a bio in the professional's own voice instead of
 * a page of identical AI paragraphs.
 *
 * The chosen text lands in the textarea as editable copy, never as a locked
 * value. The footer says so, because a professional who thinks the draft is
 * final will not fix the one detail that is wrong.
 */
import * as React from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useOnboarding } from './context'

export function BioDrafter({
  open,
  onOpenChange,
  onChoose,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (bio: string) => void
}) {
  const { draft, categories } = useOnboarding()
  const [keywords, setKeywords] = React.useState('')
  const [options, setOptions] = React.useState<string[]>([])
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const category = categories.find((option) => option.id === draft.categoryId) ?? null

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/professional/onboarding/bio', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          keywords,
          // Sent from the draft rather than re-read server-side: the bio should
          // describe what the professional has typed on screen right now, not
          // whatever the last autosave happened to land.
          businessName: draft.businessName,
          category: category?.name ?? null,
          areas: draft.serviceAreas.slice(0, 4),
          yearsExperience: draft.yearsExperience,
        }),
      })

      const body = (await response.json().catch(() => null)) as {
        data?: { options?: string[] }
        error?: string
      } | null

      if (!response.ok || !body?.data?.options?.length) {
        setError(body?.error ?? 'That didn’t work. Try again in a moment.')
        return
      }
      setOptions(body.data.options)
    } catch {
      setError('That didn’t work. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="A few words about your work"
      description="We’ll turn these into three bios you can edit."
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Keywords"
          hint="e.g. plumber, 10 years, Chaguanas, emergency callouts"
          value={keywords}
          maxLength={200}
          onChange={(event) => setKeywords(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && keywords.trim()) {
              event.preventDefault()
              void generate()
            }
          }}
        />

        <Button onClick={generate} isLoading={busy} loadingLabel="Writing…" className="self-start">
          <Sparkles className="size-4" aria-hidden="true" />
          {options.length > 0 ? 'Generate 3 more' : 'Generate 3 options'}
        </Button>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        {options.length > 0 && (
          <>
            <ul className="flex flex-col gap-3">
              {options.map((option, index) => (
                <li
                  key={index}
                  className="border-border bg-card-subtle flex flex-col gap-3 rounded-[--radius-control] border p-4"
                >
                  <p className="text-body text-sm leading-relaxed">{option}</p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        onChoose(option)
                        onOpenChange(false)
                      }}
                    >
                      Use this
                    </Button>
                    <Button size="sm" variant="ghost" onClick={generate} disabled={busy}>
                      <RefreshCw className="size-3.5" aria-hidden="true" />
                      Regenerate
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-muted text-xs">You can edit any option after choosing.</p>
          </>
        )}
      </div>
    </Modal>
  )
}
