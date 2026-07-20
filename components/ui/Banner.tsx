'use client'

import * as React from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'

/**
 * Banner (playbook S072, contract v2/details "Also in the closed set").
 *
 * **ONE BANNER PER SURFACE. THIS COMPONENT NEVER STACKS.**
 *
 * That is the entire design of it, so it is worth being explicit about why.
 * Banners accrete: one for the trial ending, one for the incomplete profile,
 * one for the failed payment, one for scheduled maintenance. Each is reasonable
 * on its own and the fourth one means the user reads none of them — a wall of
 * coloured strips is wallpaper, and the payment failure that actually needed
 * attention is now indistinguishable from the marketing nudge.
 *
 * So the priority decision lives on the PAGE, not in this component. The page
 * knows which of its conditions matters most right now; a stacking container
 * would only know the order the conditions happened to be written in. The
 * component deliberately accepts a single `kind` and a single `text` and offers
 * no list API — if you find yourself rendering two Banners in one view, the fix
 * is a resolver above them that picks one, never a second Banner.
 *
 * Rough precedence when writing that resolver: something broken and blocking
 * (destructive/warning) beats something expiring, which beats something merely
 * informational. Success banners are the shortest-lived of all — they confirm
 * an action the user just took, and a Toast is usually the better home for that.
 */

// No CVA here on purpose: `kind` changes the ICON colour only, so there is no
// variant matrix to express. A full amber or green fill across the page width
// is louder than anything a banner needs to be, and it fights the status-colour
// law that reserves saturated fills for Badge. The surface is always the same.
const BANNER_BASE =
  'border-border bg-card-subtle flex items-start gap-3 rounded-[--radius-card] border p-4'

const ICONS = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
} as const

const ICON_COLOUR = {
  info: 'text-info',
  warning: 'text-warning',
  success: 'text-success',
} as const

export type BannerProps = {
  kind?: 'info' | 'warning' | 'success'
  /** One sentence. Says what is true and what it means for this user. */
  text: string
  /** A single action. Two actions in a banner means it should be a Modal. */
  action?: { label: string; href?: string; onClick?: () => void }
  /** Only for banners the user can genuinely finish with. Never on blocking ones. */
  onDismiss?: () => void
  className?: string
}

export function Banner({ kind = 'info', text, action, onDismiss, className }: BannerProps) {
  const Icon = ICONS[kind]

  return (
    <div
      // Warnings interrupt; info and success are read in turn. `alert` on an
      // informational banner hijacks the screen reader for something that could
      // have waited, so the role is earned rather than applied uniformly.
      role={kind === 'warning' ? 'alert' : 'status'}
      className={cn(BANNER_BASE, className)}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', ICON_COLOUR[kind])} aria-hidden="true" />

      <p className="text-body flex-1 text-sm text-pretty">{text}</p>

      {action && (
        <div className="shrink-0">
          {action.href ? (
            <Button asChild variant="secondary" size="sm">
              <a href={action.href}>{action.label}</a>
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            // 16px glyph, 44px target — the padding does the accessibility work
            // without making the banner taller.
            'text-muted -m-2 inline-flex size-11 shrink-0 items-center justify-center',
            'hover:text-foreground rounded-[--radius-control] transition-[color] duration-150',
            'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'
          )}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
