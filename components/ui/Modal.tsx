'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Sheet } from './Sheet'

/**
 * Modal / Dialog (playbook S067, contract v2/02 §2.5.1 #10).
 *
 * **Below 768px this renders as a bottom Sheet.** One component, two
 * presentations — the spec calls this the single highest-leverage primitive
 * change for mobile-first (D36). Every dialog on the platform inherits a
 * thumb-reachable mobile form for free, and no call site has to know.
 *
 * ## The breakpoint has to be SSR-safe
 *
 * The server has no viewport. Reading `window.matchMedia` during render would
 * throw there; reading it in an effect and calling `setState` renders the wrong
 * presentation for one frame and is the derived-state-in-effect pattern React 19
 * rejects. `useSyncExternalStore` is the tool built for exactly this: it takes a
 * server snapshot used for SSR *and* for the hydration render — so client and
 * server markup agree by construction — then re-renders once with the real value
 * if they differ. No mismatch warning, no flash.
 *
 * The server snapshot is `false` (desktop). It is the safer default: the
 * correction happens before paint in practice, and dialogs open in response to a
 * click, which is always after hydration. The one visible cost is crossing 768px
 * *while a dialog is open* — the Radix tree is swapped, so the dialog re-enters.
 * Rare enough to accept; noted so it is not mistaken for a bug.
 *
 * ## Why `dismissable` is a prop rather than a caller-side `onOpenChange` guard
 *
 * Destructive confirms must not be dismissable by backdrop click or Esc, because
 * both are reflexes rather than decisions. Guarding in `onOpenChange` still lets
 * Radix run its close animation first. Preventing the events at source is the
 * only version that actually holds.
 *
 * Focus is trapped by Radix and returned to the trigger on close. Nothing here
 * touches `onCloseAutoFocus` — overriding it is how that guarantee gets broken.
 */

/** Spec's mobile boundary. `.98` avoids a dead zone at exactly 768px. */
const SHEET_BREAKPOINT_QUERY = '(max-width: 767.98px)'

function subscribeToViewport(onChange: () => void): () => void {
  const query = window.matchMedia(SHEET_BREAKPOINT_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function readIsBelowBreakpoint(): boolean {
  return window.matchMedia(SHEET_BREAKPOINT_QUERY).matches
}

function serverIsBelowBreakpoint(): boolean {
  return false
}

/** Exported so patterns needing the same morph read the same boundary. */
export function useIsSheetViewport(): boolean {
  return React.useSyncExternalStore(
    subscribeToViewport,
    readIsBelowBreakpoint,
    serverIsBelowBreakpoint
  )
}

/**
 * M5. Keyframes rather than transitions because Radix waits on `animationend`
 * to unmount — a transition would let the dialog vanish mid-exit.
 *
 * Centring is done by a flex wrapper, not `translate(-50%, -50%)`, so the
 * keyframe owns `transform` outright and the two cannot fight.
 */
const MODAL_MOTION_CSS = `
@keyframes tl-modal-scrim-in { from { opacity: 0 } }
@keyframes tl-modal-scrim-out { to { opacity: 0 } }
@keyframes tl-modal-in { from { opacity: 0; transform: translateY(8px) scale(0.98) } }
@keyframes tl-modal-out { to { opacity: 0; transform: translateY(8px) scale(0.98) } }
[data-tl-modal-scrim][data-state='open'] {
  animation: tl-modal-scrim-in 250ms cubic-bezier(0, 0, 0.2, 1);
}
[data-tl-modal-scrim][data-state='closed'] {
  animation: tl-modal-scrim-out 250ms cubic-bezier(0.4, 0, 1, 1);
}
[data-tl-modal][data-state='open'] {
  animation: tl-modal-in 250ms cubic-bezier(0, 0, 0.2, 1);
}
[data-tl-modal][data-state='closed'] {
  animation: tl-modal-out 250ms cubic-bezier(0.4, 0, 1, 1);
}
`

export type ModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `md` = max-w-lg, `lg` = max-w-2xl. */
  size?: 'md' | 'lg'
  title: string
  /** Feeds `aria-describedby`. One sentence — what this dialog is for. */
  description?: string
  /** False for destructive confirms: no backdrop-click close, no Esc close. */
  dismissable?: boolean
  /**
   * Right-aligned. The primary action goes LAST in DOM order — that puts it
   * rightmost visually and last in tab order, which is where a decision belongs.
   */
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function Modal({
  open,
  onOpenChange,
  size = 'md',
  title,
  description,
  dismissable = true,
  footer,
  children,
  className,
}: ModalProps) {
  const isSheetViewport = useIsSheetViewport()

  if (isSheetViewport) {
    return (
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        dismissable={dismissable}
        footer={footer}
        className={className}
      >
        {children}
      </Sheet>
    )
  }

  const blockDismiss = (event: { preventDefault: () => void }) => {
    if (!dismissable) event.preventDefault()
  }

  return (
    <>
      <style href="tl-modal-motion" precedence="default">
        {MODAL_MOTION_CSS}
      </style>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            data-tl-modal-scrim=""
            className="bg-foreground/40 fixed inset-0 z-50"
          />
          {/* pointer-events-none so a click beside the panel reaches the scrim
              and Radix's outside-dismiss still fires. */}
          <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
            <DialogPrimitive.Content
              data-tl-modal=""
              onEscapeKeyDown={blockDismiss}
              onPointerDownOutside={blockDismiss}
              onInteractOutside={blockDismiss}
              {...(description ? null : { 'aria-describedby': undefined })}
              className={cn(
                'border-border bg-card pointer-events-auto flex w-full flex-col',
                'rounded-[--radius-panel] border shadow-lg',
                'max-h-[85vh]',
                size === 'lg' ? 'max-w-2xl' : 'max-w-lg',
                className
              )}
            >
              <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6 pb-4">
                <div className="min-w-0">
                  <DialogPrimitive.Title className="text-foreground text-display-md">
                    {title}
                  </DialogPrimitive.Title>
                  {description && (
                    <DialogPrimitive.Description className="text-body mt-2 text-sm">
                      {description}
                    </DialogPrimitive.Description>
                  )}
                </div>

                {/* Omitted entirely when not dismissable: a close affordance that
                    the Esc key contradicts is worse than none. */}
                {dismissable && (
                  <DialogPrimitive.Close
                    aria-label="Close"
                    className={cn(
                      'text-muted hover:bg-card-subtle hover:text-foreground',
                      '-mt-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center',
                      'rounded-[--radius-control]',
                      'transition-transform duration-75 ease-out active:scale-[0.98]',
                      'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'
                    )}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </DialogPrimitive.Close>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
                {children}
              </div>

              {footer && (
                <div className="border-border flex shrink-0 items-center justify-end gap-3 border-t px-6 py-4">
                  {footer}
                </div>
              )}
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
