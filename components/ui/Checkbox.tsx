'use client'

import * as React from 'react'
import * as RadixCheckbox from '@radix-ui/react-checkbox'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Checkbox (playbook S064, contract v2/details/components-primitives.md §5).
 *
 * A checkbox is for consent that travels with a form submission — legal
 * acceptance, confirmations, multi-select filters applied on Apply. If ticking
 * it should change something immediately, that is a Switch, not a checkbox.
 * The distinction is not cosmetic: people expect a checkbox to be provisional
 * until they submit, and an instant-effect checkbox quietly breaks that.
 *
 * Two details worth the extra markup:
 *
 * 1. **The whole row is the target.** The control is 20px, well under the 44px
 *    minimum, so the visual box sits inside a `<label>` that stretches the full
 *    row and carries the height. Nobody should have to hit a 20px square on a
 *    phone to agree to terms.
 *
 * 2. **The tick is always mounted.** Radix unmounts the indicator when
 *    unchecked, which means an un-tick would snap with no transition. Keeping
 *    it mounted at zero opacity lets both directions animate.
 */

/**
 * 120ms, per the primitives contract §5. Shorter than the catalogue's `short`
 * (150ms) because the tick is a confirmation, not a reveal — it should land
 * before the finger lifts.
 */
const CHECK_DURATION = 'duration-[120ms]'

const boxClasses = cn(
  'group peer flex size-5 shrink-0 items-center justify-center',
  'rounded-[--radius-tag] border border-border bg-card-subtle',
  // Named properties only — never `all`.
  'transition-[background-color,border-color] duration-150 ease-out',
  'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
  'data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent',
  'text-accent-foreground',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  'disabled:cursor-not-allowed'
)

const indicatorClasses = cn(
  'flex items-center justify-center opacity-0',
  'transition-[opacity,transform] ease-out',
  CHECK_DURATION,
  'scale-75'
)

export type CheckboxProps = Omit<
  React.ComponentPropsWithoutRef<typeof RadixCheckbox.Root>,
  'children' | 'asChild'
> & {
  label?: React.ReactNode
  /** Secondary line under the label — the "what this means" clause. */
  description?: React.ReactNode
  error?: string
}

export const Checkbox = React.forwardRef<
  React.ComponentRef<typeof RadixCheckbox.Root>,
  CheckboxProps
>(function Checkbox({ label, description, error, className, disabled, id, ...props }, ref) {
  const reactId = React.useId()
  const controlId = id ?? `checkbox-${reactId}`
  const errorId = `${controlId}-error`
  const descriptionId = `${controlId}-description`

  const control = (
    <RadixCheckbox.Root
      ref={ref}
      id={controlId}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : description ? descriptionId : undefined}
      // When labelled, the row carries the disabled dimming — applying it here
      // as well would compound to 25% opacity.
      className={cn(boxClasses, !label && 'disabled:opacity-50', !label && className)}
      {...props}
    >
      <RadixCheckbox.Indicator
        // Kept mounted so unchecking animates too, not just checking.
        forceMount
        className={cn(
          indicatorClasses,
          'group-data-[state=checked]:scale-100 group-data-[state=checked]:opacity-100',
          'group-data-[state=indeterminate]:scale-100 group-data-[state=indeterminate]:opacity-100'
        )}
      >
        <Check
          className="hidden size-3.5 group-data-[state=checked]:block"
          strokeWidth={3}
          aria-hidden="true"
        />
        <Minus
          className="hidden size-3.5 group-data-[state=indeterminate]:block"
          strokeWidth={3}
          aria-hidden="true"
        />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  )

  if (!label) return control

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* min-h-11 gives the 20px control a 44px row to live in. */}
      <label
        htmlFor={controlId}
        className={cn(
          'flex min-h-11 cursor-pointer items-start gap-3 py-2',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        {/* Nudged down so the box aligns with the first line's cap height. */}
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

      {error && (
        // role="alert" so it is announced when it appears, not only on focus.
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  )
})
