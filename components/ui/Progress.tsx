'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { motion } from '@/lib/motion'

/**
 * ProgressBar and StepIndicator (playbook S070, contract v2/details §22).
 *
 * **The fill is a `scaleX`, never a width.** This is the whole reason the
 * primitive exists rather than being hand-rolled per surface. A width
 * animation runs layout on every frame of the fill; `scaleX` on a full-width
 * bar composites off the main thread (M10, and the rule in `lib/motion.ts`).
 * The visual result is identical and the cost is not, particularly on the
 * mid-range Android that most of our professionals use.
 *
 * **StepIndicator has two presentations, not one responsive one.** Dots with
 * labels need horizontal room; at 375px five labels either wrap into a mess or
 * truncate into nonsense. So mobile states the position in words — "Step 2 of
 * 5" — and shows the same information as a bar. Same component, two honest
 * renderings, rather than one that is bad at both.
 */

export type ProgressBarProps = {
  value: number
  max: number
  /** Visible label above the bar. Also becomes the accessible name. */
  label?: string
  /** Renders the completion percentage in mono beside the label. */
  showPercentage?: boolean
  className?: string
}

export function ProgressBar({ value, max, label, showPercentage, className }: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1
  const fraction = Math.min(1, Math.max(0, value / safeMax))
  const percentage = Math.round(fraction * 100)

  const labelId = React.useId()

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || showPercentage) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && (
            <span id={labelId} className="text-body text-sm">
              {label}
            </span>
          )}
          {showPercentage && (
            // The role=progressbar below already carries the value for
            // assistive tech; announcing it twice is noise.
            <span aria-hidden="true" className="text-muted font-mono text-xs tabular-nums">
              {percentage}%
            </span>
          )}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : 'Progress'}
        className="bg-border h-1 w-full overflow-hidden rounded-full"
      >
        <div
          className={cn('bg-accent h-full w-full', motion('progressFill'))}
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>
    </div>
  )
}

export type StepIndicatorProps = {
  /** Step labels, in order. */
  steps: string[]
  /** The step in progress, 1-based. */
  current: number
  className?: string
}

export function StepIndicator({ steps, current, className }: StepIndicatorProps) {
  const total = steps.length
  const clamped = Math.min(Math.max(current, 1), Math.max(total, 1))
  const currentLabel = steps[clamped - 1]

  return (
    <div className={className}>
      {/* Mobile: position in words plus a bar. */}
      <div className="flex flex-col gap-1.5 sm:hidden">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-foreground text-sm font-medium">{currentLabel}</span>
          <span className="text-muted text-xs">
            Step <span className="font-mono tabular-nums">{clamped}</span> of{' '}
            <span className="font-mono tabular-nums">{total}</span>
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Step ${clamped} of ${total}: ${currentLabel ?? ''}`}
          className="bg-border h-1 w-full overflow-hidden rounded-full"
        >
          <div
            className={cn('bg-accent h-full w-full', motion('progressFill'))}
            style={{ transform: `scaleX(${total > 0 ? clamped / total : 0})` }}
          />
        </div>
      </div>

      {/* Desktop: dots and labels. An ordered list, because the order is the
          information — a screen reader should hear "3 of 5", not five
          unrelated words. */}
      <ol className="hidden items-start sm:flex">
        {steps.map((step, index) => {
          const position = index + 1
          const isComplete = position < clamped
          const isCurrent = position === clamped

          return (
            <li
              key={step}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex flex-1 flex-col items-center gap-2 text-center"
            >
              <div className="flex w-full items-center gap-2">
                {/* Connectors sit either side so the dots stay centred on
                    their labels regardless of label length. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-px flex-1',
                    index === 0 && 'invisible',
                    isComplete || isCurrent ? 'bg-accent' : 'bg-border'
                  )}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-full text-xs',
                    isComplete && 'bg-accent text-accent-foreground',
                    isCurrent && 'bg-card text-foreground ring-accent ring-2',
                    !isComplete && !isCurrent && 'bg-card-subtle text-muted border-border border'
                  )}
                >
                  {isComplete ? (
                    <Check className="size-3.5" />
                  ) : (
                    <span className="font-mono tabular-nums">{position}</span>
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-px flex-1',
                    index === total - 1 && 'invisible',
                    isComplete ? 'bg-accent' : 'bg-border'
                  )}
                />
              </div>

              <span
                className={cn(
                  'px-1 text-xs',
                  isCurrent ? 'text-foreground font-medium' : 'text-muted'
                )}
              >
                <span className="sr-only">
                  Step {position} of {total}
                  {isComplete ? ', completed' : ''}
                  {isCurrent ? ', current' : ''}:{' '}
                </span>
                {step}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
