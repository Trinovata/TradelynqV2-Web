'use client'

import { useRef, useEffect, type HTMLAttributes, type CSSProperties } from 'react'
import { cn } from '@/lib/utils/cn'

type AnimationVariant = 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' | 'scale' | 'blur'

interface AnimatedSectionProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  /** entrance animation variant */
  variant?: AnimationVariant
  /** delay in seconds */
  delay?: number
  /** animation duration */
  duration?: number
  /** trigger once on first view, or every time? */
  once?: boolean
  /** viewport margin to trigger early */
  viewMargin?: string
}

export function AnimatedSection({
  children,
  variant = 'fade-up',
  delay = 0,
  duration = 0.5,
  once = true,
  viewMargin = '-50px',
  className,
  style,
  ...props
}: AnimatedSectionProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.setAttribute('data-visible', 'true')
          if (once) observer.unobserve(el)
        } else if (!once) {
          el.removeAttribute('data-visible')
        }
      },
      { rootMargin: viewMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [once, viewMargin])

  return (
    <div
      ref={ref}
      data-animate={variant}
      className={cn(className)}
      style={
        {
          '--anim-delay': `${delay}s`,
          '--anim-duration': `${duration}s`,
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      {children}
    </div>
  )
}
