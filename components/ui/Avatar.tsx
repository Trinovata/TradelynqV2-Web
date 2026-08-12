import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Avatar (playbook S070, contract v2/details §17).
 *
 * Two decisions worth stating:
 *
 * 1. **Initials are derived, never passed in.** A caller-supplied initial is a
 *    caller-supplied opportunity to render "AB" for one professional on the
 *    search card and "A" on their profile. Deriving them from the name means
 *    the same person shows the same two letters everywhere, forever.
 *
 * 2. **The verified overlay is suppressed below 40px.** A shield rendered at
 *    24px is a coloured smudge — it reads as decoration, or as damage. A trust
 *    signal that cannot be recognised is worse than no signal, because it still
 *    costs attention. Below 40px, verification must be carried by a Badge
 *    beside the avatar instead.
 *
 * `alt` is required: an avatar with no accessible name is a mystery circle to
 * anyone using a screen reader, and it is always someone's name.
 */

export type AvatarSize = 24 | 32 | 40 | 64 | 96

const SIZE_CLASS: Record<AvatarSize, string> = {
  24: 'size-6 text-[10px]',
  32: 'size-8 text-xs',
  40: 'size-10 text-sm',
  64: 'size-16 text-lg',
  96: 'size-24 text-2xl',
}

/** The shield scales with the avatar; it must stay legible without dominating. */
const BADGE_CLASS: Record<AvatarSize, string> = {
  24: '',
  32: '',
  40: 'size-3.5 -right-0.5 -bottom-0.5',
  64: 'size-5 -right-0.5 -bottom-0.5',
  96: 'size-6 -right-1 -bottom-1',
}

/** Below this the shield is unreadable, so it is not drawn at all. */
const MIN_VERIFIED_SIZE = 40

/**
 * Two letters, deterministic from the name.
 *
 * First and last word, so "Marlon Anthony Baptiste" is MB on every surface.
 * A single word gives one letter rather than two from the same word — "AL"
 * for "Alicia" invents an initial that is not hers.
 */
export function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => /\p{L}/u.test(word))

  const first = words[0]
  if (!first) return '?'

  const last = words.length > 1 ? words[words.length - 1] : undefined
  const letters = last ? `${first[0] ?? ''}${last[0] ?? ''}` : (first[0] ?? '')

  return letters.toLocaleUpperCase()
}

export type AvatarProps = {
  src?: string | null
  /** Required. Normally the person's or business's name. */
  alt: string
  /** Source for the initials fallback. Defaults to `alt`. */
  name?: string
  size?: AvatarSize
  /** Renders the shield-check overlay. Ignored below 40px — see the note above. */
  verified?: boolean
  className?: string
}

export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { src, alt, name, size = 40, verified = false, className },
  ref
) {
  const initials = getInitials(name ?? alt)
  const showVerified = verified && size >= MIN_VERIFIED_SIZE

  return (
    <span ref={ref} className={cn('relative inline-flex shrink-0', className)}>
      <AvatarPrimitive.Root
        className={cn('relative flex overflow-hidden rounded-full select-none', SIZE_CLASS[size])}
      >
        {src && <AvatarPrimitive.Image src={src} alt={alt} className="size-full object-cover" />}
        <AvatarPrimitive.Fallback
          className="bg-accent-soft text-accent-ink flex size-full items-center justify-center font-medium"
          // The initials are a visual stand-in for the image; the accessible
          // name comes from the sr-only text below so a reader hears "Marlon
          // Baptiste", not the letters "M B".
          aria-hidden="true"
        >
          {initials}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>

      {/* Present whether or not the image loads — Radix swaps Image for
          Fallback on load failure, and the accessible name must survive that
          swap, so it is rendered unconditionally rather than only when `!src`. */}
      <span className="sr-only">{alt}</span>

      {showVerified && (
        <span
          className={cn(
            'bg-card text-success absolute grid place-items-center rounded-full',
            BADGE_CLASS[size]
          )}
        >
          <ShieldCheck className="size-full" aria-hidden="true" />
          <span className="sr-only">Verified</span>
        </span>
      )}
    </span>
  )
})
