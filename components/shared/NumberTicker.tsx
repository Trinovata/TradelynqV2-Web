'use client'

/**
 * NumberTicker — a count-up that plays once, when it scrolls into view.
 *
 * V1's landing had this (via magicui); this is its V2 return, dependency-free.
 * A number that counts up draws the eye to the one fact it states — movement
 * with a purpose, not decoration. It only ever animates REAL values passed in
 * from live data; it is a renderer, never a source of claims.
 *
 * Engineering notes: the animation writes `textContent` through a ref inside
 * rAF — zero React re-renders per frame. The server renders the FINAL value, so
 * no-JS readers and crawlers see the truth; the effect rewinds to 0 and plays
 * only when motion is allowed and the element is actually visible. Ease-out
 * quint, so it lands softly instead of stopping dead.
 */
import * as React from 'react'

export function NumberTicker({
  value,
  suffix = '',
  durationMs = 1100,
  className = '',
}: {
  value: number
  suffix?: string
  durationMs?: number
  className?: string
}) {
  const ref = React.useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (value <= 0) return

    let frame = 0
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          observer.disconnect()

          const start = performance.now()
          const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / durationMs)
            const eased = 1 - Math.pow(1 - progress, 5)
            node.textContent = `${Math.round(value * eased).toLocaleString('en-TT')}${suffix}`
            if (progress < 1) frame = requestAnimationFrame(tick)
          }
          node.textContent = `0${suffix}`
          frame = requestAnimationFrame(tick)
        }
      },
      { threshold: 0.6 }
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value, suffix, durationMs])

  return (
    <span ref={ref} className={`font-mono tabular-nums ${className}`}>
      {value.toLocaleString('en-TT')}
      {suffix}
    </span>
  )
}
