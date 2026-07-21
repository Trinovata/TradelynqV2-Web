'use client'

/**
 * Scroll-reveal wrapper.
 *
 * Plays a short rise-and-fade the first time its content enters the viewport, so
 * sections arrive as you reach them rather than all animating on load (which
 * reads as a canned intro). `delay` staggers siblings for a choreographed feel.
 *
 * Driven entirely through the DOM ref — no React state, so it cannot trigger a
 * re-render and holds no cascading-render risk. The server markup renders
 * VISIBLE, so a no-JS reader and a reduced-motion user always see the content;
 * only when motion is allowed does the effect hide it and animate it in. Reveals
 * sit below the fold, so hiding-after-paint is never seen.
 */
import * as React from 'react'

export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'li'
}) {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    node.style.opacity = '0'
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.style.animation = `tlReveal 620ms cubic-bezier(0.16,1,0.3,1) ${delay}ms both`
            observer.disconnect()
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [delay])

  const Component = Tag as React.ElementType
  return (
    <Component ref={ref} className={className}>
      {children}
    </Component>
  )
}
