'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils/cn'

/**
 * Tooltip (playbook S068, contract v2/02 §2.5.1 #13).
 *
 *     <Tooltip content="Visible to Customers only">
 *       <button aria-label="Visibility">…</button>
 *     </Tooltip>
 *
 * ## Two constraints enforced by the type, not by a comment
 *
 * **`content` is `string`, not `ReactNode`.** The spec says a tooltip never
 * contains interactive content — a link inside one is unreachable, because
 * moving the pointer towards it dismisses the thing you were aiming at. Typing
 * the prop as a string makes that unrepresentable rather than merely discouraged,
 * the same move `Badge`'s closed status union makes.
 *
 * **It is never the sole carrier of information.** A tooltip does not exist on
 * touch — Radix ignores touch pointer events by design, so a long-press shows
 * nothing, and that is correct rather than a gap to patch. Anything a user must
 * know to complete a task belongs in visible text; a tooltip only ever
 * *elaborates*. Icon-only triggers still need their own `aria-label`: the
 * tooltip describes the control, it does not name it.
 *
 * ## Colour
 *
 * Inverted — `--foreground` fill with background-coloured text. It reads as an
 * annotation floating above the page rather than another card on it, and it
 * inverts correctly in both themes because both sides are tokens.
 */

/** Spec: 300ms. Long enough that a pointer crossing the screen triggers nothing. */
const HOVER_DELAY_MS = 300

/** M4 — fade and a short slide from the trigger's side. */
const TOOLTIP_MOTION_CSS = `
@keyframes tl-tooltip-in { from { opacity: 0; transform: translateY(2px) scale(0.98) } }
@keyframes tl-tooltip-out { to { opacity: 0 } }
[data-tl-tooltip][data-state='delayed-open'],
[data-tl-tooltip][data-state='instant-open'] {
  animation: tl-tooltip-in 150ms cubic-bezier(0, 0, 0.2, 1);
}
[data-tl-tooltip][data-state='closed'] {
  animation: tl-tooltip-out 150ms cubic-bezier(0.4, 0, 1, 1);
}
`

export type TooltipProps = {
  /** Plain text only, by design. See the note above. */
  content: string
  /** The trigger. Must accept a ref and spread props — Radix uses `asChild`. */
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  /** Escape hatch for a demo or a test. Leave alone in product surfaces. */
  delayMs?: number
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delayMs = HOVER_DELAY_MS,
}: TooltipProps) {
  return (
    <>
      <style href="tl-tooltip-motion" precedence="default">
        {TOOLTIP_MOTION_CSS}
      </style>
      {/*
        A provider per tooltip rather than one in the shell. The trade is
        deliberate: the component works anywhere with no setup, at the cost of
        Radix's cross-tooltip "skip the delay for the next one" grouping. Tooltips
        on this platform are sparse and rarely adjacent, so the grouping buys
        little and the zero-setup guarantee prevents the failure mode where a
        tooltip silently does nothing because a shell forgot its provider.
      */}
      <TooltipPrimitive.Provider delayDuration={delayMs}>
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              data-tl-tooltip=""
              side={side}
              align={align}
              sideOffset={6}
              // Radix keeps the tooltip open while the pointer is over it, which
              // invites the "move onto the tooltip" reflex. Nothing here is
              // clickable, so let it close instead of hovering a dead surface.
              onPointerDownOutside={(event) => event.preventDefault()}
              className={cn(
                'bg-foreground text-background z-50 max-w-60',
                'rounded-[--radius-tag] px-2 py-1 text-xs',
                'shadow-md select-none'
              )}
            >
              {content}
              <TooltipPrimitive.Arrow className="fill-foreground" width={10} height={5} />
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    </>
  )
}
