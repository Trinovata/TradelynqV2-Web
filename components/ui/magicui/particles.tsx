'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils/cn'

interface ParticlesProps extends React.HTMLAttributes<HTMLCanvasElement> {
  /** number of particles */
  quantity?: number
  /** particle colour */
  color?: string // lexicon-ok: CSS-facing prop name, not user copy
  /** ease factor — lower = faster response */
  ease?: number
  /** whether particles react to mouse */
  stationary?: boolean
  /** canvas size modifier */
  size?: number
  /** refresh trigger */
  refresh?: boolean
  /** individual particle size */
  particleSize?: number
}

interface Circle {
  x: number
  y: number
  translateX: number
  translateY: number
  size: number
  alpha: number
  targetAlpha: number
  dx: number
  dy: number
  magnetism: number
}

export function Particles({
  className,
  quantity = 50,
  color = '#00bcd4', // lexicon-ok: canvas fillStyle needs a resolved colour; default is brand cyan
  ease = 50,
  stationary = false,
  size = 0.4,
  refresh = false,
  particleSize = 2,
  ...props
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const context = useRef<CanvasRenderingContext2D | null>(null)
  const circles = useRef<Circle[]>([])
  const mouse = useRef({ x: 0, y: 0 })
  const canvasSize = useRef({ w: 0, h: 0 })
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
  const [isReady, setIsReady] = useState(false)

  const hexToRgb = (hex: string) => {
    hex = hex.replace('#', '')
    if (hex.length === 3)
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('')
    const num = parseInt(hex, 16)
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
  }

  const rgb = hexToRgb(color) // lexicon-ok: CSS-facing identifier, not user copy

  const circleParams = useCallback((): Circle => {
    const cw = canvasSize.current.w
    const ch = canvasSize.current.h
    return {
      x: Math.floor(Math.random() * cw),
      y: Math.floor(Math.random() * ch),
      translateX: 0,
      translateY: 0,
      size: Math.floor(Math.random() * 2 + particleSize) * size,
      alpha: 0,
      targetAlpha: parseFloat((Math.random() * 0.6 + 0.1).toFixed(1)),
      dx: (Math.random() - 0.5) * 0.1,
      dy: (Math.random() - 0.5) * 0.1,
      magnetism: 0.1 + Math.random() * 4,
    }
  }, [size, particleSize])

  const drawCircle = useCallback(
    (circle: Circle, update = false) => {
      if (!context.current) return
      const { x, y, translateX, translateY, size: s, alpha } = circle
      context.current.translate(translateX, translateY)
      context.current.beginPath()
      context.current.arc(x, y, s, 0, 2 * Math.PI)
      context.current.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
      context.current.fill()
      context.current.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!update) circles.current.push(circle)
    },
    [dpr, rgb]
  )

  const initCanvas = useCallback(() => {
    if (!canvasContainerRef.current || !canvasRef.current) return
    circles.current = []
    canvasSize.current.w = canvasContainerRef.current.offsetWidth
    canvasSize.current.h = canvasContainerRef.current.offsetHeight
    canvasRef.current.width = canvasSize.current.w * dpr
    canvasRef.current.height = canvasSize.current.h * dpr
    canvasRef.current.style.width = `${canvasSize.current.w}px`
    canvasRef.current.style.height = `${canvasSize.current.h}px`
    context.current = canvasRef.current.getContext('2d')
    if (context.current) context.current.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [dpr])

  const animate = useCallback(() => {
    if (!context.current) return
    context.current.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h)
    circles.current.forEach((circle, i) => {
      const edge = [
        circle.x + circle.translateX - circle.size,
        canvasSize.current.w - circle.x - circle.translateX - circle.size,
        circle.y + circle.translateY - circle.size,
        canvasSize.current.h - circle.y - circle.translateY - circle.size,
      ]
      const closestEdge = Math.min(...edge)
      const remapClosestEdge = parseFloat(Math.min(Math.max(closestEdge / 20, 0), 1).toFixed(2))
      if (remapClosestEdge > 1) {
        circle.alpha += 0.02
        if (circle.alpha > circle.targetAlpha) circle.alpha = circle.targetAlpha
      } else {
        circle.alpha = circle.targetAlpha * remapClosestEdge
      }
      circle.x += circle.dx
      circle.y += circle.dy
      if (!stationary) {
        circle.translateX += (mouse.current.x / (ease * 10) - circle.translateX) / ease
        circle.translateY += (mouse.current.y / (ease * 10) - circle.translateY) / ease
      }
      // reset offscreen particles
      if (
        circle.x < -circle.size ||
        circle.x > canvasSize.current.w + circle.size ||
        circle.y < -circle.size ||
        circle.y > canvasSize.current.h + circle.size
      ) {
        circles.current[i] = circleParams()
        drawCircle(circles.current[i], true)
      } else {
        drawCircle({ ...circle, x: circle.x, y: circle.y }, true)
      }
    })
  }, [circleParams, drawCircle, ease, stationary])

  useEffect(() => {
    initCanvas()
    for (let i = 0; i < quantity; i++) drawCircle(circleParams())

    // Drive the loop from the effect (V1 let the callback call itself,
    // which could never be cancelled — a leak on unmount) and defer the
    // ready flag to the first painted frame instead of a synchronous
    // setState inside the effect.
    let raf = requestAnimationFrame(function loop() {
      animate()
      raf = requestAnimationFrame(loop)
    })
    const readyRaf = requestAnimationFrame(() => setIsReady(true))

    const handleResize = () => {
      initCanvas()
      for (let i = 0; i < quantity; i++) drawCircle(circleParams())
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(raf)
      cancelAnimationFrame(readyRaf)
    }
  }, [quantity, refresh, initCanvas, circleParams, drawCircle, animate])

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      if (canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect()
        mouse.current = {
          x: e.clientX - rect.left - canvasSize.current.w / 2,
          y: e.clientY - rect.top - canvasSize.current.h / 2,
        }
      }
    }
    if (!stationary) window.addEventListener('mousemove', handleMouse)
    return () => window.removeEventListener('mousemove', handleMouse)
  }, [stationary])

  return (
    <div ref={canvasContainerRef} className={cn('absolute inset-0', className)} aria-hidden="true">
      <canvas
        ref={canvasRef}
        className={cn(
          'size-full transition-opacity duration-1000',
          isReady ? 'opacity-100' : 'opacity-0'
        )}
        {...props}
      />
    </div>
  )
}
