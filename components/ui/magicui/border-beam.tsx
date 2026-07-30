'use client'

import { cn } from '@/lib/utils/cn'

interface BorderBeamProps extends React.HTMLAttributes<HTMLDivElement> {
  /** beam size in px */
  size?: number
  /** animation duration in seconds */
  duration?: number
  /** delay before starting */
  delay?: number
  /** beam colour — defaults to brand cyan */
  colorFrom?: string
  /** beam end colour — defaults to brand amber */
  colorTo?: string
  /** border width */
  borderWidth?: number
}

export function BorderBeam({
  className,
  size = 200,
  duration = 12,
  delay = 0,
  colorFrom = 'hsl(187 100% 42%)',
  colorTo = 'hsl(38 92% 50%)',
  borderWidth = 1.5,
  ...props
}: BorderBeamProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 rounded-[inherit]', className)}
      style={
        {
          '--border-beam-size': `${size}px`,
          '--border-beam-duration': `${duration}s`,
          '--border-beam-delay': `${delay}s`,
          '--border-beam-color-from': colorFrom,
          '--border-beam-color-to': colorTo,
          '--border-beam-width': `${borderWidth}px`,
        } as React.CSSProperties
      }
      {...props}
    >
      <div className="absolute inset-0 rounded-[inherit] border-[length:var(--border-beam-width)] border-transparent [mask-image:linear-gradient(transparent,transparent),linear-gradient(white,white)] [mask-composite:intersect] [mask-clip:padding-box,border-box]">
        <div
          className="animate-border-beam absolute aspect-square"
          style={{
            width: 'var(--border-beam-size)',
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            background: `linear-gradient(to left, var(--border-beam-color-from), var(--border-beam-color-to), transparent)`,
          }}
        />
      </div>
    </div>
  )
}
