'use client'

import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Toast (playbook S068, contract v2/02 §2.5.1 #12).
 *
 *     toast('Enquiry sent', { kind: 'success' })
 *     toast('Could not save', { kind: 'error', action: { label: 'Retry', onClick: save } })
 *
 * ## Why the queue lives outside React
 *
 * The API is a plain function, callable from an event handler, a `catch` block,
 * or a module with no component around it. That means the queue cannot be
 * component state — it is a module-level store, read by `<Toaster />` through
 * `useSyncExternalStore`. The server snapshot is a frozen empty array so SSR and
 * hydration agree, and `getSnapshot` returns a stable reference between mutations
 * (returning a fresh `[]` each call is the classic way to make that hook loop
 * forever).
 *
 * ## The rules that stop toasts becoming wallpaper
 *
 * - **Three at once, maximum.** A fourth pushes the oldest out. A stack that
 *   grows without limit stops being read at about item four.
 * - **Errors get 8s, everything else 5s.** An error usually asks for a decision;
 *   a success is a receipt.
 * - **A progress bar shows the clock.** A countdown you cannot see feels
 *   arbitrary when it beats you to the action button.
 *
 * ## Announcements
 *
 * Radix mounts one polite live region per provider and `<Toaster />` is mounted
 * once in the shell, so there is exactly one on the page. Do not mount a second.
 */

export type ToastKind = 'success' | 'error' | 'info'

export type ToastOptions = {
  kind?: ToastKind
  /** One action, never two. A toast is not a dialog. */
  action?: { label: string; onClick: () => void }
}

type ToastRecord = {
  id: string
  message: string
  kind: ToastKind
  action?: { label: string; onClick: () => void }
  durationMs: number
}

const MAX_STACKED = 3
const DURATION_DEFAULT_MS = 5000
const DURATION_ERROR_MS = 8000

// ── The queue (module-level external store) ──────────────────────────────────

const EMPTY: ReadonlyArray<ToastRecord> = Object.freeze([])

let queue: ReadonlyArray<ToastRecord> = EMPTY
let sequence = 0

const listeners = new Set<() => void>()

function publish(next: ReadonlyArray<ToastRecord>) {
  queue = next
  listeners.forEach((listener) => listener())
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

function getSnapshot(): ReadonlyArray<ToastRecord> {
  return queue
}

function getServerSnapshot(): ReadonlyArray<ToastRecord> {
  return EMPTY
}

/**
 * Shows a toast. Returns its id so a caller can dismiss it early — for a
 * "Saving…" that resolves, for instance.
 */
export function toast(message: string, opts: ToastOptions = {}): string {
  const kind = opts.kind ?? 'info'
  const record: ToastRecord = {
    id: `toast-${++sequence}`,
    message,
    kind,
    ...(opts.action ? { action: opts.action } : null),
    durationMs: kind === 'error' ? DURATION_ERROR_MS : DURATION_DEFAULT_MS,
  }
  // slice(-MAX) drops from the front — the oldest collapses, per spec.
  publish([...queue, record].slice(-MAX_STACKED))
  return record.id
}

export function dismissToast(id: string): void {
  publish(queue.filter((record) => record.id !== id))
}

// ── Presentation ─────────────────────────────────────────────────────────────

/**
 * M11 for enter/exit, plus the progress bar's scaleX drain (transform, not
 * width — width animates layout on every frame, scaleX composites).
 *
 * The bar pauses on hover to match Radix, which pauses its own dismiss timer
 * there. Two independent clocks kept in step by hand; if Radix ever exposes a
 * paused data-attribute, key off that instead.
 */
const TOAST_MOTION_CSS = `
@keyframes tl-toast-in { from { opacity: 0; transform: translateY(0.5rem) } }
@keyframes tl-toast-out { to { opacity: 0; transform: translateY(0.5rem) } }
@keyframes tl-toast-swipe-out { to { transform: translateX(var(--radix-toast-swipe-end-x)) } }
@keyframes tl-toast-progress { from { transform: scaleX(1) } to { transform: scaleX(0) } }
[data-tl-toast][data-state='open'] {
  animation: tl-toast-in 200ms cubic-bezier(0, 0, 0.2, 1);
}
[data-tl-toast][data-state='closed'] {
  animation: tl-toast-out 200ms cubic-bezier(0.4, 0, 1, 1);
}
[data-tl-toast][data-swipe='move'] {
  transform: translateX(var(--radix-toast-swipe-move-x));
}
[data-tl-toast][data-swipe='cancel'] {
  transform: translateX(0);
  transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
}
[data-tl-toast][data-swipe='end'] {
  animation: tl-toast-swipe-out 200ms cubic-bezier(0.4, 0, 1, 1);
}
[data-tl-toast-progress] {
  animation: tl-toast-progress linear forwards;
}
[data-tl-toast]:hover [data-tl-toast-progress],
[data-tl-toast]:focus-within [data-tl-toast-progress] {
  animation-play-state: paused;
}
`

const KIND_ICON: Record<ToastKind, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
}

// Colour lands on the icon and the progress bar only. A fully tinted surface
// would compete with Badge's status-colour law for the same meanings.
const KIND_ACCENT: Record<ToastKind, string> = {
  success: 'text-success',
  error: 'text-destructive',
  info: 'text-info',
}

const KIND_BAR: Record<ToastKind, string> = {
  success: 'bg-success',
  error: 'bg-destructive',
  info: 'bg-info',
}

function ToastItem({ record }: { record: ToastRecord }) {
  const Icon = KIND_ICON[record.kind]

  return (
    <ToastPrimitive.Root
      data-tl-toast=""
      duration={record.durationMs}
      onOpenChange={(open) => {
        if (!open) dismissToast(record.id)
      }}
      className={cn(
        'border-border bg-card relative overflow-hidden',
        'rounded-[--radius-card] border shadow-lg',
        'flex items-start gap-3 p-4 pr-3'
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', KIND_ACCENT[record.kind])} aria-hidden="true" />

      <ToastPrimitive.Description className="text-body min-w-0 flex-1 text-sm">
        {record.message}
      </ToastPrimitive.Description>

      {record.action && (
        <ToastPrimitive.Action
          asChild
          // Read to screen-reader users as the alternative to the button, since
          // the toast will be gone before they can reach it.
          altText={record.action.label}
        >
          <button
            type="button"
            onClick={record.action.onClick}
            className={cn(
              'text-accent-ink shrink-0 text-sm font-medium underline-offset-4 hover:underline',
              'transition-transform duration-75 ease-out active:scale-[0.98]',
              'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
              'rounded-[--radius-tag]'
            )}
          >
            {record.action.label}
          </button>
        </ToastPrimitive.Action>
      )}

      <ToastPrimitive.Close
        aria-label="Dismiss"
        className={cn(
          'text-muted hover:text-foreground -mt-1 shrink-0',
          'inline-flex size-6 items-center justify-center rounded-[--radius-tag]',
          'transition-transform duration-75 ease-out active:scale-[0.98]',
          'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'
        )}
      >
        <X className="size-3.5" aria-hidden="true" />
      </ToastPrimitive.Close>

      <span
        data-tl-toast-progress=""
        aria-hidden="true"
        style={{ animationDuration: `${record.durationMs}ms` }}
        className={cn('absolute inset-x-0 bottom-0 h-0.5 origin-left', KIND_BAR[record.kind])}
      />
    </ToastPrimitive.Root>
  )
}

/**
 * Mount once, in the app shell. Everything else talks to `toast()`.
 */
export function Toaster() {
  const records = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return (
    <>
      <style href="tl-toast-motion" precedence="default">
        {TOAST_MOTION_CSS}
      </style>
      <ToastPrimitive.Provider swipeDirection="right" label="Notification">
        {records.map((record) => (
          <ToastItem key={record.id} record={record} />
        ))}
        <ToastPrimitive.Viewport
          className={cn(
            'fixed z-100 flex list-none flex-col gap-2 outline-none',
            // Mobile: clear of the tab bar and the home indicator. A toast the
            // tab bar covers is a toast nobody reads.
            'right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-4',
            // Desktop: top-right, out of the reading path.
            'md:top-4 md:right-4 md:bottom-auto md:left-auto md:w-96'
          )}
        />
      </ToastPrimitive.Provider>
    </>
  )
}
