'use client'

import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useSpring } from 'motion/react'
import { cn } from '@/lib/utils/cn'

interface NumberTickerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** target number to count up to */
  value: number
  /** direction: up (default) or down */
  direction?: 'up' | 'down'
  /** animation duration factor — higher = slower */
  duration?: number
  /** delay before starting (ms) */
  delay?: number
  /** decimal places */
  decimalPlaces?: number
  /** prefix text, e.g. "TTD $" */
  prefix?: string
  /** suffix text, e.g. "+" */
  suffix?: string
}

export function NumberTicker({
  value,
  direction = 'up',
  duration = 0.6,
  delay = 0,
  decimalPlaces = 0,
  prefix = '',
  suffix = '',
  className,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(direction === 'down' ? value : 0)
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100 / duration,
  })
  const isInView = useInView(ref, { once: true, margin: '0px' })

  useEffect(() => {
    if (isInView) {
      const timeout = setTimeout(() => {
        motionValue.set(direction === 'down' ? 0 : value)
      }, delay)
      return () => clearTimeout(timeout)
    }
  }, [motionValue, isInView, delay, value, direction])

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent =
          prefix +
          Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(latest.toFixed(decimalPlaces))) +
          suffix
      }
    })
    return unsubscribe
  }, [springValue, decimalPlaces, prefix, suffix])

  return (
    <span ref={ref} className={cn('tracking-tight tabular-nums', className)} {...props}>
      {prefix}0{suffix}
    </span>
  )
}
