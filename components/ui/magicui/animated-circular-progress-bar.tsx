'use client'

import { cn } from '@/lib/utils/cn'

interface AnimatedCircularProgressBarProps {
  /** value 0-100 */
  value: number
  /** minimum value (default 0) */
  min?: number
  /** maximum value (default 100) */
  max?: number
  /** inner label text */
  label?: React.ReactNode
  /** circle diameter in px */
  size?: number
  /** stroke width */
  strokeWidth?: number
  /** track colour class */
  trackClassName?: string
  /** fill colour class */
  fillClassName?: string
  className?: string
}

export function AnimatedCircularProgressBar({
  value,
  min = 0,
  max = 100,
  label,
  size = 96,
  strokeWidth = 8,
  trackClassName,
  fillClassName,
  className,
}: AnimatedCircularProgressBarProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(Math.max(value, min), max)
  const percent = (clamped - min) / (max - min)
  const offset = circumference * (1 - percent)

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={min}
      aria-valuemax={max}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn('stroke-slate-200', trackClassName)}
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            'stroke-brand-cyan transition-[stroke-dashoffset] duration-700 ease-out',
            fillClassName
          )}
        />
      </svg>
      {label !== undefined && (
        <div className="absolute inset-0 flex items-center justify-center">{label}</div>
      )}
    </div>
  )
}
