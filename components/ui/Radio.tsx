'use client'

import * as React from 'react'
import * as RadixRadioGroup from '@radix-ui/react-radio-group'
import { cn } from '@/lib/utils/cn'

/**
 * Radio / RadioGroup (playbook S064, contract v2/details/components-primitives.md §6).
 *
 * Radios are for one choice out of a small, visible set where seeing all the
 * options is part of the decision — tier, interaction mode, payment method. If
 * the list is long enough that scanning it is work, that is a Select.
 *
 * The keyboard contract is the reason this wraps Radix rather than a stack of
 * `<input type="radio">`: a radio group is ONE tab stop, and the arrow keys move
 * within it. Hand-rolled groups almost always leak every option into the tab
 * order, which turns a five-option group into five obstacles for a keyboard user.
 *
 * As with Checkbox, the 20px control sits inside a `<label>` that stretches the
 * whole row, so the hit area clears 44px without inflating the visual.
 */

/**
 * 120ms, per the primitives contract §6 — the dot lands before the finger
 * lifts. Shorter than the motion catalogue's `short` (150ms) by design.
 */
const DOT_DURATION = 'duration-[120ms]'

const dotClasses = cn(
  'group peer flex size-5 shrink-0 items-center justify-center rounded-full',
  'border border-border bg-card-subtle',
  // Named properties only — never `all`.
  'transition-[background-color,border-color] duration-150 ease-out',
  'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  'disabled:cursor-not-allowed'
)

export type RadioGroupProps = React.ComponentPropsWithoutRef<typeof RadixRadioGroup.Root> & {
  label?: string
  /** Shown under the group. Suppressed while an error is displayed. */
  hint?: string
  error?: string
}

/**
 * The group is labelled with `role="radiogroup"` + `aria-labelledby` rather than
 * a `<fieldset>`/`<legend>`: legends are notoriously hard to style consistently
 * and Radix already supplies the correct role.
 */
export const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof RadixRadioGroup.Root>,
  RadioGroupProps
>(function RadioGroup({ label, hint, error, className, children, ...props }, ref) {
  const reactId = React.useId()
  const labelId = `radiogroup-${reactId}-label`
  const hintId = `radiogroup-${reactId}-hint`
  const errorId = `radiogroup-${reactId}-error`

  // Error takes precedence over the hint: one clear instruction beats two.
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span id={labelId} className="text-foreground text-sm font-medium">
          {label}
        </span>
      )}

      <RadixRadioGroup.Root
        ref={ref}
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cn('flex flex-col', className)}
        {...props}
      >
        {children}
      </RadixRadioGroup.Root>

      {error ? (
        // role="alert" so it is announced when it appears, not only on focus.
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
})

export type RadioProps = Omit<
  React.ComponentPropsWithoutRef<typeof RadixRadioGroup.Item>,
  'children' | 'asChild'
> & {
  label?: React.ReactNode
  /** Secondary line under the label — what choosing this actually means. */
  description?: React.ReactNode
}

export const Radio = React.forwardRef<React.ComponentRef<typeof RadixRadioGroup.Item>, RadioProps>(
  function Radio({ label, description, className, disabled, id, value, ...props }, ref) {
    const reactId = React.useId()
    const controlId = id ?? `radio-${reactId}`
    const descriptionId = `${controlId}-description`

    const control = (
      <RadixRadioGroup.Item
        ref={ref}
        id={controlId}
        value={value}
        disabled={disabled}
        aria-describedby={description ? descriptionId : undefined}
        // When labelled the row carries the disabled dimming — applying it here
        // as well would compound to 25% opacity.
        className={cn(dotClasses, !label && 'disabled:opacity-50', !label && className)}
        {...props}
      >
        <RadixRadioGroup.Indicator
          // Kept mounted so deselection animates too, not just selection.
          forceMount
          asChild
        >
          <span
            className={cn(
              'bg-accent-foreground size-2 scale-0 rounded-full opacity-0',
              'transition-[opacity,transform] ease-out',
              DOT_DURATION,
              'group-data-[state=checked]:scale-100 group-data-[state=checked]:opacity-100'
            )}
          />
        </RadixRadioGroup.Indicator>
      </RadixRadioGroup.Item>
    )

    if (!label) return control

    return (
      // min-h-11 gives the 20px control a 44px row to live in.
      <label
        htmlFor={controlId}
        className={cn(
          'flex min-h-11 cursor-pointer items-start gap-3 py-2',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        {/* Nudged so the dot aligns with the first line's cap height. */}
        <span className="flex h-5 items-center">{control}</span>

        <span className="flex flex-col gap-0.5">
          <span className="text-body text-sm">{label}</span>
          {description && (
            <span id={descriptionId} className="text-muted text-xs">
              {description}
            </span>
          )}
        </span>
      </label>
    )
  }
)
