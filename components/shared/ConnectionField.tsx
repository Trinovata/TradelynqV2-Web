/**
 * ConnectionField — the hero's quiet signature: connections orbiting a centre.
 *
 * The product is one idea — a customer at the centre, the right professionals
 * reachable around them — so the hero renders exactly that and nothing more: a
 * loose ring of nodes with a few bright signals travelling between them, a
 * network gently humming. The earlier version literally labelled each node with
 * a trade; a dozen words scattered behind the headline is what made it read as a
 * cluttered infographic. This one carries the same meaning with no text at all —
 * the shape does the work.
 *
 * Pure SVG + CSS, server-rendered — no canvas, no JS. Only `stroke-dashoffset`
 * animates, so the GPU carries it. The radial mask CLEARS the centre, so the
 * ring frames the type rather than sitting under it, and the headline always
 * lands on calm space. Under reduced-motion the signals hold still and it
 * becomes a still diagram. Navy nodes, cyan signals — tokens, so it re-themes.
 */

type Node = { x: number; y: number; hub?: boolean }

// A ring of nodes around a faint central hub on a 1200×620 canvas. The centre
// is where the headline sits, so the mask hides it — the ring is the visible part.
const HUB: Node = { x: 600, y: 310, hub: true }
const RING: Node[] = [
  { x: 600, y: 70 },
  { x: 864, y: 116 },
  { x: 1028, y: 236 },
  { x: 1028, y: 384 },
  { x: 864, y: 504 },
  { x: 600, y: 550 },
  { x: 336, y: 504 },
  { x: 172, y: 384 },
  { x: 172, y: 236 },
  { x: 336, y: 116 },
]

const NODES: Node[] = [...RING, HUB]
const HUB_INDEX = NODES.length - 1

// Edges: the ring itself (neighbour to neighbour), plus a few faint spokes to the
// hub. The spokes mostly fall under the mask, so they only hint at the centre.
const RING_EDGES: [number, number][] = RING.map((_, i) => [i, (i + 1) % RING.length])
const SPOKES: [number, number][] = [
  [HUB_INDEX, 0],
  [HUB_INDEX, 3],
  [HUB_INDEX, 6],
]
const EDGES: [number, number][] = [...RING_EDGES, ...SPOKES]

function length(a: Node, b: Node): number {
  return Math.round(Math.hypot(b.x - a.x, b.y - a.y))
}

export function ConnectionField({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:radial-gradient(ellipse_58%_54%_at_50%_46%,transparent,transparent_34%,black_72%,black_88%,transparent)] ${className}`}
    >
      <svg
        viewBox="0 0 1200 620"
        preserveAspectRatio="xMidYMid slice"
        className="text-accent size-full opacity-70"
      >
        {/* Faint base edges — the resting network */}
        {EDGES.map(([from, to], index) => {
          const a = NODES[from]!
          const b = NODES[to]!
          return (
            <line
              key={`base-${index}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className="stroke-border"
              strokeWidth={1}
            />
          )
        })}

        {/* A few signals travelling the ring — a pulse orbiting, not every edge
            lit at once. Slow and staggered so it reads as calm, never busy. */}
        {RING_EDGES.map(([from, to], index) => {
          // Only every other ring edge carries a signal — half-lit keeps it quiet.
          if (index % 2 !== 0) return null
          const a = NODES[from]!
          const b = NODES[to]!
          const len = length(a, b)
          const duration = 5 + (index % 3) * 1.3
          const delay = index * 0.8
          return (
            <line
              key={`signal-${index}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className="stroke-brand-cyan motion-safe:animate-[tlSignalFlow_var(--dur)_linear_infinite]"
              strokeWidth={1.5}
              strokeLinecap="round"
              style={
                {
                  strokeDasharray: `20 ${len}`,
                  strokeDashoffset: len,
                  ['--signal-length']: `${len + 20}`,
                  ['--dur']: `${duration}s`,
                  animationDelay: `${delay}s`,
                } as React.CSSProperties
              }
            />
          )
        })}

        {/* Nodes — small and still. No labels, no breathing; the ring is the idea. */}
        {NODES.map((node, index) => (
          <circle
            key={`node-${index}`}
            cx={node.x}
            cy={node.y}
            r={node.hub ? 5 : 3}
            className={node.hub ? 'fill-brand-cyan' : 'fill-accent'}
          />
        ))}
      </svg>
    </div>
  )
}
