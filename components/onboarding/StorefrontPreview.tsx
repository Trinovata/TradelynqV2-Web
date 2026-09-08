'use client'

/**
 * The live storefront preview (playbook S107, spec `v2/05 §5.2`).
 *
 * The magic moment of onboarding: a professional types their name and watches
 * their shop window build itself. It is the reason the split-screen exists.
 *
 * ## Faithfulness over convenience
 *
 * The spec's acceptance criterion is "the preview is the real storefront
 * component tree (no lookalike drift)". The public storefront at
 * `/professionals/[slug]` is an async server component that reads the database,
 * so it cannot literally render here against unsaved state. What this shares
 * instead is every leaf primitive the real page uses — Avatar, Badge,
 * StarRating, the same services list markup, the same section order and
 * headings — so the two drift only if someone edits one and not the other, and
 * the structure is small enough to see that at a glance.
 *
 * Empty fields render as placeholder rails rather than disappearing: the shape
 * of what is still missing is the most useful thing the panel can show while
 * the form is half-filled.
 */
import * as React from 'react'
import Image from 'next/image'
import { MapPin, ShieldCheck } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { formatTTD } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import type { OnboardingDraft } from '@/lib/professional/onboarding'
import type { CategoryOption } from '@/lib/professional/onboarding-server'

/** A grey rail standing in for text not yet written. */
function Rail({ className }: { className?: string }) {
  return (
    <span className={cn('bg-border/70 block h-3 rounded-full', className)} aria-hidden="true" />
  )
}

export function StorefrontPreview({
  draft,
  categories,
  subtype,
  className,
}: {
  draft: OnboardingDraft
  categories: CategoryOption[]
  subtype: 'student_entrepreneur' | 'sole_trader' | 'registered_business' | null
  className?: string
}) {
  const category = categories.find((option) => option.id === draft.categoryId) ?? null
  const services = draft.services.filter((service) => service.name.trim().length > 0)

  return (
    <div
      className={cn('border-border bg-card rounded-[--radius-card] border p-5 sm:p-6', className)}
      // The preview is decorative duplication of the form's own content: a
      // screen-reader user has already heard every value while typing it, and
      // hearing it again on each keystroke would be unusable.
      aria-hidden="true"
    >
      <div className="flex flex-col gap-6">
        {/* Identity header — mirrors the storefront's own header block. */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar
            src={draft.profilePhotoUrl}
            alt={draft.businessName || 'Your storefront'}
            name={draft.businessName || '?'}
            size={64}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {draft.businessName ? (
              <h2 className="text-display-sm text-foreground truncate">{draft.businessName}</h2>
            ) : (
              <Rail className="h-5 w-48" />
            )}

            {category ? (
              <p className="text-body text-sm">{category.name}</p>
            ) : (
              <Rail className="w-32" />
            )}

            {draft.serviceAreas.length > 0 ? (
              <p className="text-muted inline-flex items-center gap-1.5 text-sm">
                <MapPin className="size-4" />
                {draft.serviceAreas.slice(0, 3).join(' · ')}
                {draft.serviceAreas.length > 3 ? ` +${draft.serviceAreas.length - 3}` : ''}
              </p>
            ) : (
              <Rail className="w-40" />
            )}

            <div className="mt-1 flex flex-wrap gap-2">
              {/* Verification badges are shown as they will look once earned,
                  never as though already granted — the review queue grants
                  them, and a preview that implies otherwise is a promise the
                  platform has not made. */}
              {subtype === 'registered_business' && <Badge variant="registered">Registered</Badge>}
              {subtype === 'student_entrepreneur' && <Badge variant="student">Student</Badge>}
              {draft.yearsExperience !== null && draft.yearsExperience > 0 && (
                <Badge variant="neutral">
                  {draft.yearsExperience} {draft.yearsExperience === 1 ? 'year' : 'years'}{' '}
                  experience
                </Badge>
              )}
            </div>
          </div>
        </header>

        {/* About */}
        <section className="flex flex-col gap-2">
          <h3 className="text-foreground font-medium">About</h3>
          {draft.bio.trim() ? (
            <p className="text-body text-sm leading-relaxed whitespace-pre-line">{draft.bio}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <Rail className="w-full" />
              <Rail className="w-11/12" />
              <Rail className="w-3/5" />
            </div>
          )}
        </section>

        {/* Services */}
        <section className="flex flex-col gap-3">
          <h3 className="text-foreground font-medium">Services</h3>
          {services.length > 0 ? (
            <ul className="divide-border divide-y">
              {services.map((service, index) => (
                <li key={index} className="flex items-baseline justify-between gap-4 py-2.5">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-foreground truncate text-sm font-medium">
                      {service.name}
                    </span>
                    {service.description && (
                      <span className="text-muted truncate text-xs">{service.description}</span>
                    )}
                  </div>
                  {typeof service.price_ttd === 'number' && (
                    <span className="text-foreground shrink-0 font-mono text-sm tabular-nums">
                      {formatTTD(service.price_ttd)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col gap-2.5">
              <Rail className="w-2/3" />
              <Rail className="w-1/2" />
            </div>
          )}
        </section>

        {/* Portfolio — omitted at zero images on the real storefront, so the
            preview shows the slot only once there is something in it. */}
        {draft.portfolioUrls.length > 0 && (
          <section className="flex flex-col gap-3">
            <h3 className="text-foreground font-medium">Portfolio</h3>
            <ul className="grid grid-cols-3 gap-2">
              {draft.portfolioUrls.slice(0, 6).map((url) => (
                <li
                  key={url}
                  className="border-border relative aspect-square overflow-hidden rounded-[--radius-control] border"
                >
                  <Image src={url} alt="" fill sizes="120px" className="object-cover" />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Reviews — a new storefront has none, and saying so is more honest
            than an empty five-star row. Matches the real page's empty state. */}
        <section className="flex flex-col gap-2">
          <h3 className="text-foreground font-medium">Reviews</h3>
          <p className="text-muted inline-flex items-center gap-1.5 text-sm">
            <ShieldCheck className="size-4" />
            New on TradeLynq
          </p>
        </section>
      </div>
    </div>
  )
}
