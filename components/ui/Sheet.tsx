'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils/cn'

/**
 * Sheet — bottom sheet (playbook S067, contract v2/02 §2.5.1 #11).
 *
 * A dialog that arrives from the bottom edge. It is the mobile presentation of
 * `Modal` (which delegates here below 768px) and a primitive in its own right
 * for anything that is inherently a bottom-anchored panel — filter stacks,
 * action lists, pickers.
 *
 * ## Three details that carry the weight
 *
 * 1. **The drag handle is a real close button.** Drag-to-dismiss is a pointer
 *    gesture, and a pointer gesture as the *only* dismissal is unusable with a
 *    keyboard or a switch device. So the grabber is a `<button>` with a label:
 *    press it and the sheet closes, drag from it and the sheet follows. A drag
 *    that travelled further than the slop threshold suppresses the click that a
 *    browser synthesises afterwards, so a released drag never double-fires.
 *
 * 2. **Exit animates from wherever the finger left it.** The close keyframe has
 *    no `from` — a `to`-only keyframe interpolates from the element's *current*
 *    computed style, which during a drag is the inline transform. Writing
 *    `from { transform: translateY(0) }` would snap the sheet back up for one
 *    frame before it left. This is why the drag offset is reset on the next
 *    open rather than on release.
 *
 * 3. **Safe-area padding is not optional.** The app sets `viewport-fit=cover`,
 *    so on a device with a home indicator the bottom of the sheet sits under
 *    it. `env(safe-area-inset-bottom)` is the only thing standing between the
 *    primary action and an unreachable button.
 *
 * ### Deviation from the written interface — flagged, not silently resolved
 *
 * The spec's `SheetProps` lists only `open`, `onOpenChange`, `height` and
 * `children`. This adds `title` (required), `description`, `hideTitle` and
 * `footer`. `title` is required because `role="dialog"` without an accessible
 * name fails WCAG 4.1.2 outright, and the spec's own a11y line demands
 * `role=dialog`; there is no correct value the component could invent on a
 * caller's behalf. `footer` exists because `Modal` delegates its footer here
 * and a footer inside the scroll region scrolls its primary action out of
 * reach. Raise with the spec owner.
 */

/** Movement beyond this many pixels counts as a drag, not a tap. */
const DRAG_SLOP_PX = 6

/** Released past this fraction of the sheet's height, it dismisses. Spec: 30%. */
const DISMISS_FRACTION = 0.3

/**
 * M6, expressed as keyframes rather than transitions because Radix's presence
 * machinery waits on `animationend` — a transition would let the sheet unmount
 * mid-exit. Hoisted and de-duplicated by React 19 via `precedence`, so mounting
 * twenty sheets still yields one stylesheet.
 *
 * The reduced-motion override in globals.css collapses these to 0.01ms, which
 * still fires `animationend`, so presence keeps working.
 */
const SHEET_MOTION_CSS = `
@keyframes tl-sheet-scrim-in { from { opacity: 0 } }
@keyframes tl-sheet-scrim-out { to { opacity: 0 } }
@keyframes tl-sheet-in { from { transform: translateY(100%) } }
@keyframes tl-sheet-out { to { transform: translateY(100%) } }
[data-tl-sheet-scrim][data-state='open'] {
  animation: tl-sheet-scrim-in 300ms cubic-bezier(0, 0, 0.2, 1);
}
[data-tl-sheet-scrim][data-state='closed'] {
  animation: tl-sheet-scrim-out 300ms cubic-bezier(0.4, 0, 1, 1);
}
[data-tl-sheet][data-state='open'] {
  animation: tl-sheet-in 300ms cubic-bezier(0, 0, 0.2, 1);
}
[data-tl-sheet][data-state='closed'] {
  animation: tl-sheet-out 300ms cubic-bezier(0.4, 0, 1, 1);
}
`

export function SheetMotionStyles() {
  return (
    <style href="tl-sheet-motion" precedence="default">
      {SHEET_MOTION_CSS}
    </style>
  )
}

export type SheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `auto` caps at 85vh and scrolls internally; `full` takes the viewport. */
  height?: 'auto' | 'full'
  /** Required: a dialog without an accessible name is unusable to a screen reader. */
  title: string
  description?: string
  /** Hides the heading visually while keeping it for assistive tech. */
  hideTitle?: boolean
  /** When false, neither the scrim nor Esc closes it. For destructive confirms. */
  dismissable?: boolean
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function Sheet({
  open,
  onOpenChange,
  height = 'auto',
  title,
  description,
  hideTitle = false,
  dismissable = true,
  footer,
  children,
  className,
}: SheetProps) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const dragOriginY = React.useRef<number | null>(null)
  const travelledRef = React.useRef(false)

  const [dragOffset, setDragOffset] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)

  // The offset is cleared when the sheet OPENS, not when the drag is released: a
  // dismissing drag has to keep its offset so the exit keyframe can interpolate
  // away from it (see note 2 above).
  //
  // Done during render rather than in an effect. React documents this as the way
  // to reset state when a prop changes ("You Might Not Need an Effect" →
  // adjusting state when a prop changes): the re-render happens before the
  // browser paints, so there is no flash of the stale offset — and no cascading
  // second commit, which is what the effect version costs.
  const [openAtLastReset, setOpenAtLastReset] = React.useState(open)
  if (open !== openAtLastReset) {
    setOpenAtLastReset(open)
    if (open) {
      setDragOffset(0)
      setIsDragging(false)
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Ignore secondary mouse buttons; a right-click is not a drag.
    if (event.pointerType === 'mouse' && event.button !== 0) return
    dragOriginY.current = event.clientY
    travelledRef.current = false
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const origin = dragOriginY.current
    if (origin === null) return
    const delta = event.clientY - origin
    if (Math.abs(delta) > DRAG_SLOP_PX) travelledRef.current = true
    // Clamped at zero: a sheet dragged upward would detach from the bottom edge.
    setDragOffset(Math.max(0, delta))
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragOriginY.current === null) return
    dragOriginY.current = null
    setIsDragging(false)

    const sheetHeight = contentRef.current?.getBoundingClientRect().height ?? 0
    const passedThreshold = sheetHeight > 0 && dragOffset / sheetHeight >= DISMISS_FRACTION

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (passedThreshold && dismissable) {
      onOpenChange(false)
      return
    }
    setDragOffset(0)
  }

  function handleHandleClick() {
    // The browser fires a click after a pointer sequence even when it was a
    // drag. Only a genuine tap should close.
    if (travelledRef.current) {
      travelledRef.current = false
      return
    }
    onOpenChange(false)
  }

  const blockDismiss = (event: { preventDefault: () => void }) => {
    if (!dismissable) event.preventDefault()
  }

  return (
    <>
      <SheetMotionStyles />
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            data-tl-sheet-scrim=""
            className="bg-foreground/40 fixed inset-0 z-50"
          />
          <DialogPrimitive.Content
            ref={contentRef}
            data-tl-sheet=""
            onEscapeKeyDown={blockDismiss}
            onPointerDownOutside={blockDismiss}
            onInteractOutside={blockDismiss}
            // Radix defaults `aria-describedby` to its own generated id and warns
            // when no Description renders. Explicitly overriding it to undefined
            // is the sanctioned opt-out for the no-description case.
            {...(description ? null : { 'aria-describedby': undefined })}
            style={{
              transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
              // Kills the snap-back easing while a finger is down, so the sheet
              // tracks the pointer exactly rather than lagging behind it.
              transitionDuration: isDragging ? '0ms' : undefined,
            }}
            className={cn(
              'border-border bg-card fixed inset-x-0 bottom-0 z-50 flex flex-col',
              'rounded-t-[--radius-panel] border-t',
              // M6 — only transform, and named. Never `transition: all`.
              'transition-transform duration-300 ease-out',
              // viewport-fit=cover means the home indicator overlaps this edge.
              'pb-[env(safe-area-inset-bottom)]',
              height === 'full'
                ? // Not 100dvh: the rounded top edge is what identifies this as a
                  // sheet rather than a page, so a strip of scrim always shows.
                  'h-[calc(100dvh-1.5rem)]'
                : 'max-h-[85vh]',
              className
            )}
          >
            {/* Grab zone: handle plus heading. Dragging from the title feels
                natural and doubles the target for an imprecise thumb. */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className="shrink-0 touch-none"
            >
              <button
                type="button"
                onClick={handleHandleClick}
                aria-label={`Close ${title}`}
                className={cn(
                  'mx-auto flex min-h-11 w-full items-center justify-center',
                  'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                  'rounded-[--radius-control]'
                )}
              >
                <span className="bg-border h-1 w-10 rounded-full" aria-hidden="true" />
              </button>

              <div className={cn('px-6 pb-4', hideTitle && 'sr-only')}>
                <DialogPrimitive.Title className="text-foreground text-display-md">
                  {title}
                </DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="text-body mt-2 text-sm">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
            </div>

            {/* overscroll-contain stops a flick at the end of this list from
                scrolling the page behind the sheet. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
              {children}
            </div>

            {footer && (
              <div className="border-border flex shrink-0 items-center justify-end gap-3 border-t px-6 py-4">
                {footer}
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
