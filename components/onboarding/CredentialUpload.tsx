'use client'

/**
 * Single-document upload for the subtype credentials (playbook S107,
 * copy `copy-professional.md §4.1`).
 *
 * A student's proof of enrolment or a Certificate of Incorporation. Separate
 * from the photo uploader because the affordance is different: nobody wants to
 * see a thumbnail of their incorporation certificate, they want to know it
 * arrived and that they can replace it.
 *
 * Each upload is independently retryable, per the spec's states clause — a
 * failure keeps the control in place with the error attached rather than
 * resetting the step.
 */
import * as React from 'react'
import { FileCheck2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { uploadProfessionalImage, ACCEPTED_IMAGE_TYPES } from './upload'
import { useOnboarding } from './context'

export function CredentialUpload({
  label,
  hint,
  note,
  value,
  onChange,
}: {
  label: string
  hint: string
  note?: string
  value: string | null
  onChange: (url: string | null) => void
}) {
  const { userId } = useOnboarding()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    const result = await uploadProfessionalImage(file, userId, 'credentials')
    setBusy(false)
    if (result.ok) onChange(result.url)
    else setError(result.message)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-foreground text-sm font-medium">{label}</span>
      <p className="text-muted text-xs">{hint}</p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="sr-only"
        onChange={(event) => {
          void handleFile(event.target.files?.[0])
          // Cleared so re-picking the same file after a failure still fires
          // `change` — otherwise a retry with the identical file does nothing.
          event.target.value = ''
        }}
      />

      {value ? (
        <div className="border-border bg-card-subtle mt-1 flex items-center gap-3 rounded-[--radius-control] border p-3">
          <FileCheck2 className="text-success size-5 shrink-0" aria-hidden="true" />
          <span className="text-body flex-1 text-sm">Document uploaded</span>
          <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()}>
            Replace
          </Button>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Remove ${label}`}
            className="text-muted hover:text-destructive"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <Button
          variant="secondary"
          className="mt-1 self-start"
          isLoading={busy}
          loadingLabel="Uploading…"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" aria-hidden="true" />
          Upload
        </Button>
      )}

      {note && <p className="text-muted mt-1 text-xs">{note}</p>}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
