import { cn } from '@/lib/utils/cn'

interface DotPatternProps extends React.SVGAttributes<SVGSVGElement> {
  /** gap between dots */
  width?: number
  /** gap between dots (vertical) */
  height?: number
  /** dot radius */
  cr?: number
  /** dot colour */
  fill?: string
}

export function DotPattern({
  width = 16,
  height = 16,
  cr = 1,
  fill = 'currentColor',
  className,
  ...props
}: DotPatternProps) {
  const id = `dot-pattern-${width}-${height}-${cr}`

  return (
    <svg
      aria-hidden="true"
      className={cn(
        'fill-muted-foreground/20 pointer-events-none absolute inset-0 h-full w-full',
        className
      )}
      {...props}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          patternContentUnits="userSpaceOnUse"
        >
          <circle cx={width / 2} cy={height / 2} r={cr} fill={fill} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}
