'use client'

/**
 * The landing hero's 3D layer (Gregg, 30 Jul: "use the 3d files for the
 * v2/V3 landing page hero") — governed by the Field doctrine (v2/02A §2A.4):
 * content never waits for it.
 *
 * Guardrails, in order:
 * - Kill flag: NEXT_PUBLIC_HERO_3D='off' disables without a code change.
 * - ConnectionField IS the poster: it renders immediately and stays; the
 *   harbour crossfades over it only after its own first frame.
 * - Mounts only after window load + an idle slot — never competes with LCP.
 * - prefers-reduced-motion, Save-Data, and 2G-class connections never mount it.
 * - three/fiber/drei arrive via dynamic import: zero bytes in the main bundle.
 */
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const HarbourScene = dynamic(() => import('./HarbourScene'), { ssr: false })

type NetworkInformationLike = { saveData?: boolean; effectiveType?: string }

function connectionAllows3D(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection
  if (!connection) return true
  if (connection.saveData) return false
  return !/(^|-)2g$/.test(connection.effectiveType ?? '')
}

export function HarbourHero() {
  const [mount, setMount] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_HERO_3D === 'off') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!connectionAllows3D()) return

    let cancelled = false
    const requestIdle =
      window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200))
    const start = () => requestIdle(() => !cancelled && setMount(true))

    if (document.readyState === 'complete') {
      start()
      return () => {
        cancelled = true
      }
    }
    window.addEventListener('load', start, { once: true })
    return () => {
      cancelled = true
      window.removeEventListener('load', start)
    }
  }, [])

  if (!mount) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-700 ease-out"
      style={{
        opacity: visible ? 0.9 : 0,
        // Clear the headline's reading space: solid at the base where the
        // harbour sits, fading out through the type zone.
        WebkitMaskImage: 'linear-gradient(to top, black 55%, transparent 92%)',
        maskImage: 'linear-gradient(to top, black 55%, transparent 92%)',
      }}
    >
      <HarbourScene onReady={() => setVisible(true)} />
    </div>
  )
}
