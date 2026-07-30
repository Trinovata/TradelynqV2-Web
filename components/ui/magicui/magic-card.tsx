'use client'

import { useMotionValue, motion, useMotionTemplate, type MotionStyle } from 'motion/react'
import { useCallback, useRef } from 'react'
import { cn } from '@/lib/utils/cn'

interface MagicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** gradient size in px */
  gradientSize?: number
  /** gradient colour (light mode) */
  gradientColor?: string
  /** gradient colour (dark mode override) */
  gradientColorDark?: string
  /** opacity of the gradient highlight */
  gradientOpacity?: number
  /** gradient from color */ // lexicon-ok: CSS-facing prop doc, not user copy
  gradientFrom?: string
  /** gradient to color */ // lexicon-ok: CSS-facing prop doc, not user copy
  gradientTo?: string
}

export function MagicCard({
  children,
  className,
  gradientSize = 200,
  gradientColor = 'hsl(187 100% 42% / 0.15)',
  gradientOpacity = 1,
  ...props
}: MagicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(-gradientSize)
  const mouseY = useMotionValue(-gradientSize)

  /**
   * Cache the bounding rectangle to avoid layout thrashing during mousemove.
   * PROFILE -> SELECT -> OPTIMIZE -> VERIFY
   */
  const rectRef = useRef<DOMRect | null>(null)

  const handleMouseEnter = useCallback(() => {
    if (cardRef.current) {
      rectRef.current = cardRef.current.getBoundingClientRect()
    }
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = rectRef.current || cardRef.current?.getBoundingClientRect()
      if (rect) {
        mouseX.set(e.clientX - rect.left)
        mouseY.set(e.clientY - rect.top)
      }
    },
    [mouseX, mouseY]
  )

  const handleMouseLeave = useCallback(() => {
    mouseX.set(-gradientSize)
    mouseY.set(-gradientSize)
    rectRef.current = null
  }, [mouseX, mouseY, gradientSize])

  const background = useMotionTemplate`
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
      ${gradientColor},
      transparent 80%)
  `

  return (
    <div
      ref={cardRef}
      className={cn(
        'group rounded-card border-border bg-card text-card-foreground shadow-card hover:shadow-card-hover relative overflow-hidden border transition-shadow duration-300',
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <motion.div
        className="rounded-card pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background, opacity: gradientOpacity } as MotionStyle}
      />
      <div className="relative">{children}</div>
    </div>
  )
}
