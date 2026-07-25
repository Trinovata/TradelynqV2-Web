'use client'

/**
 * Portfolio gallery + Lightbox (playbook S081, spec v2/03 §3.4 section 4).
 *
 * Grid, not true masonry: portfolio_urls carry no dimension metadata, and
 * masonry without known aspect ratios is CLS by construction — the spec's own
 * acceptance ("all images aspect-ratio-reserved") outranks its "masonry" word.
 * Every tile reserves 4:3; M16 blur-up settles each image as it loads.
 * FLAG: revisit as true masonry when upload-time dimension capture lands
 * (storefront manager, S113).
 *
 * The Lightbox is a native <dialog> — free focus trap, Esc handling, and
 * ::backdrop, with M5 on entry (same keyframe pattern as Modal.tsx: the
 * catalogue's 250ms enter curve, applied via a scoped style block). Arrow keys
 * and swipe change images; the buttons make both reachable without a keyboard
 * or a touchscreen.
 */
import * as React from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

/** M5 (modal) entry, mirrored from Modal.tsx's keyframe treatment. */
const LIGHTBOX_MOTION_CSS = `
@keyframes tl-lightbox-in { from { opacity: 0; transform: translateY(8px) scale(0.98) } }
dialog[data-tl-lightbox][open] {
  animation: tl-lightbox-in 250ms cubic-bezier(0, 0, 0.2, 1);
}
dialog[data-tl-lightbox][open]::backdrop {
  animation: tl-lightbox-in 250ms cubic-bezier(0, 0, 0.2, 1);
}
`

type Props = {
  images: string[]
  /** For alt text: "Portfolio image N — {name}". */
  name: string
}

export function PortfolioGallery({ images, name }: Props) {
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const [open, setOpen] = React.useState<number | null>(null)
  const [loaded, setLoaded] = React.useState<Set<number>>(new Set())
  const touchStartX = React.useRef<number | null>(null)

  const show = (index: number) => {
    setOpen(index)
    dialogRef.current?.showModal()
  }
  const close = React.useCallback(() => {
    dialogRef.current?.close()
    setOpen(null)
  }, [])
  const step = React.useCallback(
    (delta: number) => {
      setOpen((current) =>
        current === null ? null : (current + delta + images.length) % images.length
      )
    },
    [images.length]
  )

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') step(1)
    if (event.key === 'ArrowLeft') step(-1)
  }

  return (
    <>
      {/* Static compile-time keyframes, rendered the same way Modal.tsx does. */}
      <style>{LIGHTBOX_MOTION_CSS}</style>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {images.map((src, index) => (
          <li key={src} className="aspect-[4/3]">
            <button
              type="button"
              onClick={() => show(index)}
              className="focus-visible:ring-ring block h-full w-full overflow-hidden rounded-[--radius-card] focus-visible:ring-2 focus-visible:outline-none"
              aria-label={`View portfolio image ${index + 1} of ${images.length}`}
            >
              {/* M16 imageSettle: blurred and slightly scaled until load. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- user upload URLs are arbitrary; next/image remote config cannot enumerate them */}
              <img
                src={src}
                alt={`Portfolio image ${index + 1} — ${name}`}
                loading="lazy"
                onLoad={() => setLoaded((prev) => new Set(prev).add(index))}
                className={`h-full w-full object-cover transition-[filter,transform] duration-300 ease-out ${
                  loaded.has(index) ? 'blur-0 scale-100' : 'scale-105 blur-md'
                }`}
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        data-tl-lightbox
        onClose={() => setOpen(null)}
        onKeyDown={onKeyDown}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current
          touchStartX.current = null
          const end = e.changedTouches[0]?.clientX
          if (start === null || end === undefined) return
          if (Math.abs(end - start) > 48) step(end < start ? 1 : -1)
        }}
        aria-label={`${name} portfolio`}
        className="m-auto max-h-[92dvh] w-[min(92vw,64rem)] bg-transparent p-0 backdrop:bg-black/80"
      >
        {open !== null && (
          <div className="relative">
            <img
              src={images[open]}
              alt={`Portfolio image ${open + 1} — ${name}`}
              className="mx-auto max-h-[86dvh] w-auto rounded-[--radius-card] object-contain"
            />
            <p className="text-center font-mono text-sm text-white/80 tabular-nums">
              {open + 1} / {images.length}
            </p>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute -top-2 right-0 -translate-y-full rounded-full bg-black/60 p-2 text-white transition-opacity hover:opacity-80"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous image"
                  className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition-opacity hover:opacity-80"
                >
                  <ChevronLeft className="size-6" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next image"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition-opacity hover:opacity-80"
                >
                  <ChevronRight className="size-6" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        )}
      </dialog>
    </>
  )
}
