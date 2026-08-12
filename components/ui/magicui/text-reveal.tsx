'use client'

import { useRef } from 'react'
import { motion, useInView, type Variants } from 'motion/react'
import { cn } from '@/lib/utils/cn'

interface TextRevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** the text to reveal */
  text: string
  /** animation variant: 'word' reveals word-by-word, 'char' reveals character-by-character */
  variant?: 'word' | 'char'
}

export function TextReveal({ text, variant = 'word', className, ...props }: TextRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: variant === 'char' ? 0.02 : 0.08,
      },
    },
  }

  const child: Variants = {
    hidden: {
      opacity: 0,
      y: 20,
      filter: 'blur(4px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        type: 'spring',
        damping: 12,
        stiffness: 100,
      },
    },
  }

  const items = variant === 'char' ? text.split('') : text.split(' ')

  return (
    <div ref={ref} {...props}>
      <motion.span
        className={cn('inline', className)}
        variants={container}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
      >
        {items.map((item, i) => (
          <motion.span key={i} variants={child} className="inline-block">
            {item}
            {variant === 'word' && i < items.length - 1 ? '\u00A0' : ''}
          </motion.span>
        ))}
      </motion.span>
    </div>
  )
}
