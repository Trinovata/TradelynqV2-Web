'use client'

/**
 * ContainerScroll — a scroll-driven 3D reveal (adapted from Aceternity UI via 21st.dev).
 *
 * As the section scrolls into view, a framed panel rotates from tilted-back to
 * flat and settles, while its heading lifts away. It is a signature "here it is
 * in action" moment — the kind of thing that makes someone ask how the site was
 * made.
 *
 * ## What changed from the source (and why it had to)
 *
 * The original hardcoded hex (`#6C6C6C`, `#222222`, `bg-gray-100`), used `dark:`
 * classes, and typed the header props as `any`. All three break this project's
 * design law (semantic tokens only, theming through tokens not `dark:`, strict
 * TypeScript) and the lexicon CI check that bans literal hex. So the frame is now
 * built from `--card` / `--border` / `--card-subtle`, it themes automatically in
 * light and dark, and every prop is typed. The scroll/rotate/scale logic — the
 * actual value of the component — is untouched.
 *
 * Only `transform` animates (rotateX, scale, translateY), so it composites on the
 * GPU, consistent with the platform's motion rule. `motion` (framer-motion's
 * successor) supplies the scroll-linked values CSS alone cannot.
 */
import * as React from 'react'
import { useScroll, useTransform, motion, type MotionValue } from 'motion/react'

export function ContainerScroll({
  titleComponent,
  children,
}: {
  titleComponent: React.ReactNode
  children: React.ReactNode
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // A smaller scale range on mobile so the panel does not overflow narrow screens.
  const scaleRange: [number, number] = isMobile ? [0.75, 0.95] : [1.02, 1]
  const rotate = useTransform(scrollYProgress, [0, 1], [18, 0])
  const scale = useTransform(scrollYProgress, [0, 1], scaleRange)
  const translate = useTransform(scrollYProgress, [0, 1], [0, -80])

  return (
    <div
      ref={containerRef}
      className="relative flex h-[52rem] items-center justify-center p-2 md:h-[64rem] md:p-12"
    >
      <div className="relative w-full py-8 [perspective:1000px] md:py-24">
        <ScrollHeader translate={translate}>{titleComponent}</ScrollHeader>
        <ScrollCard rotate={rotate} scale={scale}>
          {children}
        </ScrollCard>
      </div>
    </div>
  )
}

function ScrollHeader({
  translate,
  children,
}: {
  translate: MotionValue<number>
  children: React.ReactNode
}) {
  return (
    <motion.div style={{ translateY: translate }} className="mx-auto max-w-5xl text-center">
      {children}
    </motion.div>
  )
}

function ScrollCard({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>
  scale: MotionValue<number>
  children: React.ReactNode
}) {
  return (
    <motion.div
      style={{ rotateX: rotate, scale }}
      className="border-border bg-card mx-auto -mt-8 h-[28rem] w-full max-w-5xl rounded-[--radius-panel] border p-2 shadow-2xl md:h-[38rem] md:p-4"
    >
      <div className="bg-card-subtle size-full overflow-hidden rounded-[--radius-card]">
        {children}
      </div>
    </motion.div>
  )
}
