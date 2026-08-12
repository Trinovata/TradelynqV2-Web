'use client'

/**
 * The harbour diorama itself — loaded ONLY through HarbourHero's guardrails,
 * never imported directly (three must stay out of the main bundle).
 *
 * Asset: /hero/harbor.glb — Gregg's 3D drop (30 Jul), compressed 44MB → 2.5MB
 * (Draco + WebP 1024px textures via gltf-transform). The Draco decoder is
 * self-hosted at /draco/ so no request ever leaves our origin.
 *
 * Framing is automatic (Bounds + Center) because the model's authored scale is
 * arbitrary; lighting is our own — no drei Stage, whose default environment
 * fetches a remote HDR.
 */
import { useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Center, Bounds } from '@react-three/drei'
import type { Group } from 'three'

const MODEL_URL = '/hero/harbor.glb'
const DRACO_PATH = '/draco/'

function Harbour() {
  const group = useRef<Group>(null)
  const { scene } = useGLTF(MODEL_URL, DRACO_PATH)

  // One slow, ambient revolution (~4 min) — presence, not spectacle. The
  // reduced-motion case never reaches this component (gated in HarbourHero).
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.025
  })

  return (
    <group ref={group}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  )
}

export default function HarbourScene({ onReady }: { onReady?: () => void }) {
  // First-frame signal drives the crossfade from ConnectionField in the parent.
  useEffect(() => {
    if (onReady) onReady()
  }, [onReady])

  return (
    <Canvas
      // Cap device-pixel-ratio: retina ×3 rendering triples the pixel bill for
      // an ambient backdrop nobody inspects up close.
      dpr={[1, 1.75]}
      camera={{ position: [0, 2.2, 7], fov: 40 }}
      gl={{ antialias: true, powerPreference: 'low-power', alpha: true }}
      // demand + a per-frame invalidation from useFrame keeps the loop honest:
      // nothing renders when the tab is hidden.
      frameloop="always"
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[6, 10, 4]} intensity={1.6} />
      <directionalLight position={[-6, 4, -4]} intensity={0.4} />
      <Bounds fit clip observe margin={1.15}>
        <Harbour />
      </Bounds>
    </Canvas>
  )
}

useGLTF.preload(MODEL_URL, DRACO_PATH)
