'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { whatsappLink, type WhatsAppClickContext, type WhatsAppTemplate } from '@/lib/whatsapp'

/**
 * WhatsAppButton — the canonical WA CTA (playbook S074, spec `components-patterns.md` §12).
 *
 * WhatsApp is the primary contact channel in Trinidad & Tobago, so every "chat"
 * affordance on the platform is this one component. Three decisions the type and
 * the styling enforce:
 *
 * 1. **No free-text messages.** The caller passes a `template` from a closed
 *    union and its data — never an arbitrary string. The copy decks write the
 *    messages; a call site cannot invent one. That is a lexicon control at the
 *    type level, and it also closes an injection surface, since the message is
 *    interpolated into a URL.
 *
 * 2. **The glyph is green; the button is not.** WhatsApp's colour lives on the
 *    icon only — the button follows `secondary` styling. A wall of green CTAs
 *    would hand the platform's most valuable position to another brand's colour
 *    and break the status-colour law, where green already means "done/verified".
 *
 * 3. **A number that cannot be parsed produces no button.** `whatsappLink`
 *    returns null for anything it cannot resolve to E.164, and rather than
 *    render a broken `wa.me` link into a dead end, this renders nothing. The
 *    number is reveal-gated upstream and only reaches here in the browser.
 */

const whatsappButtonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-[--radius-control] font-medium',
    // Secondary styling — brand discipline. Only the glyph carries WhatsApp green.
    'bg-card text-body border border-border hover:bg-card-subtle',
    // M1 press. Only transform animates — never `transition: all`.
    'transition-transform duration-75 ease-out active:scale-[0.98]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  ],
  {
    variants: {
      variant: {
        // Occupies a primary CTA slot (full width, tall) while staying secondary
        // in colour — the storefront's main "chat" action.
        'primary-position': 'h-12 w-full px-6 text-base',
        secondary: 'h-10 px-4 text-sm',
        // 44px touch target around a 20px glyph — the compact icon slot.
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'secondary' },
  }
)

export type WhatsAppButtonProps = VariantProps<typeof whatsappButtonVariants> & {
  /** E.164. NEVER rendered before the reveal gate passes upstream. */
  phone: string
  /** Closed union of deck-written context messages — no free text by design. */
  template: WhatsAppTemplate
  /** `{name}`, `{ref}`… interpolated and URL-encoded by `whatsappLink`. */
  templateData: Record<string, string>
  /** Forwarded to `whatsapp_clicked{context}` — kept as a data attribute for the analytics layer. */
  context: WhatsAppClickContext
  /**
   * Fire-and-forget analytics hook. The link still opens WhatsApp regardless of
   * what this does — analytics never sits in the click's critical path.
   */
  onWhatsApp?: () => void
  className?: string
}

export const WhatsAppButton = React.forwardRef<HTMLAnchorElement, WhatsAppButtonProps>(
  function WhatsAppButton(
    { phone, template, templateData, variant = 'secondary', context, onWhatsApp, className },
    ref
  ) {
    const href = whatsappLink(phone, template, templateData)
    // Unparseable number → no link → no button. Better than a dead `wa.me` tap.
    if (!href) return null

    const name = templateData.name?.trim()
    // The accessible name always says who the chat is with — "Chat with Marlon on
    // WhatsApp" is more use to a screen-reader user than a bare "WhatsApp".
    const ariaLabel = name ? `Chat with ${name} on WhatsApp` : 'Chat on WhatsApp'
    const isIcon = variant === 'icon'

    return (
      <a
        ref={ref}
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={ariaLabel}
        data-wa-context={context}
        onClick={() => onWhatsApp?.()}
        className={cn(whatsappButtonVariants({ variant }), className)}
      >
        <MessageCircle
          aria-hidden="true"
          className={cn('text-whatsapp shrink-0', isIcon ? 'size-5' : 'size-4')}
        />
        {!isIcon && <span>Message on WhatsApp</span>}
      </a>
    )
  }
)

export { whatsappButtonVariants }
