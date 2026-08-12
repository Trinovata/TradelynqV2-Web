'use client'

import { cn } from '@/lib/utils/cn'

interface AnimatedGradientTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Gradient CSS string. Defaults to TradeLynq cyan → amber */
  gradient?: string
  /** Animation duration. Default 4s */
  duration?: string
}

export function AnimatedGradientText({
  children,
  className,
  gradient = 'linear-gradient(90deg, hsl(187 100% 42%), hsl(38 92% 50%), hsl(187 100% 42%))',
  duration = '4s',
  ...props
}: AnimatedGradientTextProps) {
  return (
    <span
      className={cn(
        'animate-gradient-x inline-block bg-[length:200%_auto] bg-clip-text text-transparent',
        className
      )}
      style={
        {
          backgroundImage: gradient,
          animationDuration: duration,
        } as React.CSSProperties
      }
      {...props}
    >
      {children}
    </span>
  )
}
