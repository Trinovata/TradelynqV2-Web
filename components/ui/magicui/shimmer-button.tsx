'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** shimmer colour */
  shimmerColor?: string
  /** shimmer size in px */
  shimmerSize?: string
  /** border radius */
  borderRadius?: string
  /** shimmer duration in seconds */
  shimmerDuration?: string
  /** background colour */
  background?: string
}

const ShimmerButton = forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = 'hsl(187 100% 82%)',
      shimmerSize = '0.1em',
      shimmerDuration = '2.5s',
      borderRadius = '8px',
      background = 'hsl(187 100% 42%)',
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'group relative inline-flex items-center justify-center gap-2 overflow-hidden px-6 py-3 font-semibold whitespace-nowrap text-white transition-[transform,opacity] duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
          className
        )}
        style={
          {
            borderRadius,
            '--shimmer-color': shimmerColor,
            '--shimmer-size': shimmerSize,
            '--shimmer-duration': shimmerDuration,
            '--bg': background,
          } as React.CSSProperties
        }
        {...props}
      >
        {/* shimmer effect */}
        <div className="absolute inset-0 overflow-hidden" style={{ borderRadius }}>
          <div className="absolute inset-0" style={{ background: 'var(--bg)' }} />
          <div className="animate-shimmer-slide absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>

        {/* content */}
        <span className="relative z-10 flex items-center gap-2">{children}</span>

        {/* hover glow  */}
        <div
          className="absolute -bottom-2 left-1/2 h-1/3 w-4/5 -translate-x-1/2 rounded-full bg-white/30 opacity-0 blur-lg transition-opacity duration-500 group-hover:opacity-100" // lexicon-ok: white glow over the shimmer fill, theme-independent by design
        />
      </button>
    )
  }
)

ShimmerButton.displayName = 'ShimmerButton'

export { ShimmerButton }
