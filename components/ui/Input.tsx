'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Input and Textarea (playbook S062, contract v2/02 §2.5.1).
 *
 * The accessibility wiring here is the point. An error message that is only
 * visually red is invisible to a screen reader, and a placeholder used as a
 * label disappears the moment someone types. So:
 *
 *   - the error is linked by `aria-describedby` and announced via `role="alert"`
 *   - `aria-invalid` marks the field itself, not just its surroundings
 *   - ids are generated with `useId` so a caller cannot forget to pass one and
 *     silently break the label association
 *
 * Errors name the fix ("Use a JPG, PNG, or WEBP under 8MB"), never just the
 * failure ("Invalid file"). A message that does not tell you what to do next is
 * a dead end wearing a helpful tone.
 */

type FieldShellProps = {
  label?: string
  /** Shown under the field. Suppressed while an error is displayed. */
  hint?: string
  error?: string
  required?: boolean
  children: (ids: { inputId: string; describedBy: string | undefined }) => React.ReactNode
  className?: string
}

function FieldShell({ label, hint, error, required, children, className }: FieldShellProps) {
  const reactId = React.useId()
  const inputId = `field-${reactId}`
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`

  // Error takes precedence: showing both competes for attention at the moment
  // the user most needs one clear instruction.
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={inputId} className="text-foreground text-sm font-medium">
          {label}
          {required && (
            <span className="text-destructive" aria-hidden="true">
              {' '}
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </label>
      )}

      {children({ inputId, describedBy })}

      {error ? (
        // role="alert" so it is announced when it appears, not only when focused.
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-muted text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

const fieldClasses = (hasError: boolean) =>
  cn(
    'w-full rounded-[--radius-control] border bg-card-subtle px-3 text-body',
    'placeholder:text-muted',
    // Only border and box-shadow transition — never `all`.
    'transition-[border-color,box-shadow] duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:cursor-not-allowed disabled:opacity-50',
    hasError ? 'border-destructive' : 'border-border focus:border-accent'
  )

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label?: string
  hint?: string
  error?: string
  /** Rendered inside the field on the left — e.g. `TTD $`, a search icon. */
  prefix?: React.ReactNode
  suffix?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, prefix, suffix, className, required, ...props },
  ref
) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {({ inputId, describedBy }) => (
        <div className="relative flex items-center">
          {prefix && (
            <span className="text-muted pointer-events-none absolute left-3 text-sm">{prefix}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            className={cn(
              fieldClasses(Boolean(error)),
              'h-10',
              prefix && 'pl-12',
              suffix && 'pr-12',
              className
            )}
            {...props}
          />
          {suffix && (
            <span className="text-muted pointer-events-none absolute right-3 text-sm">
              {suffix}
            </span>
          )}
        </div>
      )}
    </FieldShell>
  )
})

export type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  label?: string
  hint?: string
  error?: string
  /** Shows a live character count. Turns amber at 90% of the limit. */
  showCount?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, showCount, maxLength, className, required, value, onChange, ...props },
  ref
) {
  // Tracks length only for the uncontrolled case. When `value` is supplied the
  // prop is the source of truth and the count is derived from it directly.
  //
  // Deliberately NOT a useEffect syncing state from the prop: that is the
  // classic derived-state anti-pattern (and React 19 lints it). It also renders
  // twice per keystroke and shows a stale count for one frame.
  const [uncontrolledLength, setUncontrolledLength] = React.useState(0)

  const isControlled = value !== undefined
  const length = isControlled ? String(value).length : uncontrolledLength

  const nearLimit = maxLength !== undefined && length >= maxLength * 0.9

  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {({ inputId, describedBy }) => (
        <div className="flex flex-col gap-1">
          <textarea
            ref={ref}
            id={inputId}
            rows={4}
            maxLength={maxLength}
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            onChange={(event) => {
              if (!isControlled) setUncontrolledLength(event.target.value.length)
              onChange?.(event)
            }}
            className={cn(fieldClasses(Boolean(error)), 'min-h-24 resize-y py-2', className)}
            {...props}
          />
          {showCount && maxLength !== undefined && (
            <span
              className={cn(
                'self-end font-mono text-xs tabular-nums',
                nearLimit ? 'text-warning' : 'text-muted'
              )}
              // The field's own limit already stops input; announcing every
              // keystroke would be noise. Screen readers get the hint text.
              aria-hidden="true"
            >
              {length} / {maxLength}
            </span>
          )}
        </div>
      )}
    </FieldShell>
  )
})
