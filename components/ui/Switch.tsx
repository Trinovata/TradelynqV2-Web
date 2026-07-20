'use client'

import * as React from 'react'
import * as RadixSwitch from '@radix-ui/react-switch'
import { cn } from '@/lib/utils/cn'

/**
 * Switch (playbook S064, contract v2/details/components-primitives.md §7).
 *
 * A switch takes effect the moment it moves — theme, webhook active, offering
 * published. That is the whole distinction from Checkbox, and it is a promise
 * to the user rather than a style choice: a switch inside a form that only
 * applies on Save is a lie the control tells. If it needs a Save button, use a
 * Checkbox.
 *
 * Because the effect is immediate, the caller almost always has an async write
 * to run. `disabled` during that write is correct; a spinner on the switch is
 * not — the control should move instantly and the surface should reconcile.
 *
 * Geometry: a 20px thumb in a 24×44px track. The track is already 44px wide,
 * and the `<label>` row supplies the 44px height, so the hit area clears the
 * touch minimum without the visual growing to match.
 */

/**
 * 120ms, per the primitives contract §7. Faster than the catalogue's `short`
 * (150ms) because the thumb travel IS the feedback — it must feel like the
 * switch moved under the finger, not after it.
 */
const THUMB_DURATION = 'duration-[120ms]'

const trackClasses = cn(
  'group peer inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5',
  'border border-transparent bg-border',
  // Named properties only — never `all`.
  'transition-[background-color] ease-out',
  THUMB_DURATION,
  'data-[state=checked]:bg-accent',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  'disabled:cursor-not-allowed'
)

const thumbClasses = cn(
  'bg-card pointer-events-none block size-5 rounded-full shadow-sm',
  // transform only — the compositable property, so travel stays smooth on a
  // mid-range Android.
  'transition-transform ease-out',
  THUMB_DURATION,
  'translate-x-0 data-[state=checked]:translate-x-5'
)

export type SwitchProps = Omit<
  React.ComponentPropsWithoutRef<typeof RadixSwitch.Root>,
  'children' | 'asChild'
> & {
  label?: React.ReactNode
  /** Secondary line under the label — what flipping this actually does. */
  description?: React.ReactNode
}

export const Switch = React.forwardRef<React.ComponentRef<typeof RadixSwitch.Root>, SwitchProps>(
  function Switch({ label, description, className, disabled, id, ...props }, ref) {
    const reactId = React.useId()
    const controlId = id ?? `switch-${reactId}`
    const descriptionId = `${controlId}-description`

    const control = (
      <RadixSwitch.Root
        ref={ref}
        id={controlId}
        disabled={disabled}
        aria-describedby={description ? descriptionId : undefined}
        // When labelled the row carries the disabled dimming — applying it here
        // as well would compound to 25% opacity.
        className={cn(trackClasses, !label && 'disabled:opacity-50', !label && className)}
        {...props}
      >
        <RadixSwitch.Thumb className={thumbClasses} />
      </RadixSwitch.Root>
    )

    if (!label) return control

    return (
      // The switch sits on the right: the label reads first, the state reads
      // last, which matches how a settings list is scanned. min-h-11 keeps the
      // row at the 44px touch minimum.
      <label
        htmlFor={controlId}
        className={cn(
          'flex min-h-11 cursor-pointer items-center justify-between gap-4 py-2',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-body text-sm">{label}</span>
          {description && (
            <span id={descriptionId} className="text-muted text-xs">
              {description}
            </span>
          )}
        </span>

        {control}
      </label>
    )
  }
)
