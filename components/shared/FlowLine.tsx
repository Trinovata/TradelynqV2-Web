'use client'

/**
 * FlowLine — the animated progression line under "How it works".
 *
 * A cyan hairline that draws left-to-right when the section scrolls into view:
 * the three steps become one continuous journey rather than three columns. The
 * V1 cyan gets to do what it always did best — signal motion and progress —
 * without becoming a surface colour.
 *
 * `scaleX` from 0 to 1 (transform-only, GPU-composited), driven through the ref
 * so there are no re-renders. Under reduced-motion the line simply shows in
 * full. Decorative, so it is aria-hidden.
 */
import * as React from 'react'

export function FlowLine({ className = '' }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    node.style.transform = 'scaleX(0)'
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          observer.disconnect()
          node.style.transition = 'transform 1200ms cubic-bezier(0.16, 1, 0.3, 1) 150ms'
          node.style.transform = 'scaleX(1)'
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div aria-hidden="true" className={`relative h-px overflow-visible ${className}`}>
      <div ref={ref} className="bg-brand-cyan/60 absolute inset-0 origin-left" />
    </div>
  )
}
