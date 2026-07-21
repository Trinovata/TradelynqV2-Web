/**
 * ConnectionField — the signature background: a marketplace, drawn as a network.
 *
 * The whole product is one idea — connecting a customer to the right
 * professional — so the hero renders that literally: nodes for people and
 * trades, faint edges between them, and bright signals that FLOW along the
 * edges, a match completing itself in real time. It is meaningful, not
 * decorative: watch it and you understand what the site does before you read a
 * word.
 *
 * Pure SVG + CSS. A server component (no JS, no canvas) that weighs almost
 * nothing. Only `stroke-dashoffset` and opacity animate, so the GPU carries it
 * and the main thread stays free; per-edge durations are staggered with primes
 * so the loop never looks periodic. Colours are tokens — navy nodes, cyan
 * signals — so it re-themes with the site. Under reduced-motion the signals hold
 * still and it becomes a calm static diagram. Masked to fade out toward the
 * content so text stays crisp on top.
 *
 * A handful of nodes carry a real trade label (the foreground layer), so the
 * network reads as THIS marketplace, not an abstract graph.
 */

type Node = { x: number; y: number; label?: string; hub?: boolean }

// A loose graph on a 1000×560 canvas. One central hub ("You") with trades
// fanning out — the shape of a search resolving into matches.
const NODES: Node[] = [
  { x: 500, y: 280, hub: true, label: 'You' },
  { x: 210, y: 150, label: 'Plumber' },
  { x: 800, y: 140, label: 'Nail tech' },
  { x: 160, y: 400, label: 'Electrician' },
  { x: 840, y: 420, label: 'Photographer' },
  { x: 500, y: 90, label: 'Tutor' },
  { x: 500, y: 480, label: 'AC tech' },
  { x: 320, y: 300 },
  { x: 680, y: 260 },
  { x: 380, y: 470 },
  { x: 660, y: 460 },
  { x: 300, y: 90 },
  { x: 720, y: 380 },
]

// Edges from the hub (and a few cross-links), each an index pair into NODES.
const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [0, 7],
  [0, 8],
  [1, 7],
  [2, 8],
  [3, 9],
  [4, 12],
  [5, 11],
  [6, 10],
  [7, 9],
  [8, 12],
]

function length(a: Node, b: Node): number {
  return Math.round(Math.hypot(b.x - a.x, b.y - a.y))
}

export function ConnectionField({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:radial-gradient(ellipse_75%_65%_at_50%_38%,black,transparent)] ${className}`}
    >
      <svg
        viewBox="0 0 1000 560"
        preserveAspectRatio="xMidYMid slice"
        className="text-accent size-full opacity-[0.9]"
      >
        {/* Faint base edges */}
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

        {/* Flowing cyan signals — a bright dash travelling each edge */}
        {EDGES.map(([from, to], index) => {
          const a = NODES[from]!
          const b = NODES[to]!
          const len = length(a, b)
          // Prime-ish, staggered durations so the field never pulses in unison.
          const duration = 2.6 + (index % 5) * 0.7
          const delay = (index % 7) * 0.45
          return (
            <line
              key={`signal-${index}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className="stroke-brand-cyan motion-safe:animate-[tlSignalFlow_var(--dur)_linear_infinite]"
              strokeWidth={1.75}
              strokeLinecap="round"
              style={
                {
                  strokeDasharray: `26 ${len}`,
                  strokeDashoffset: len,
                  ['--signal-length']: `${len + 26}`,
                  ['--dur']: `${duration}s`,
                  animationDelay: `${delay}s`,
                } as React.CSSProperties
              }
            />
          )
        })}

        {/* Nodes */}
        {NODES.map((node, index) => (
          <g key={`node-${index}`}>
            <circle
              cx={node.x}
              cy={node.y}
              r={node.hub ? 7 : 4}
              className={
                node.hub
                  ? 'fill-brand-cyan'
                  : 'fill-accent motion-safe:animate-[tlNodeBreathe_var(--dur)_ease-in-out_infinite]'
              }
              style={
                {
                  ['--node-r']: node.hub ? '7' : '4',
                  ['--dur']: `${3 + (index % 4)}s`,
                  animationDelay: `${(index % 6) * 0.5}s`,
                } as React.CSSProperties
              }
            />
            {node.hub && (
              <circle
                cx={node.x}
                cy={node.y}
                r={7}
                className="stroke-brand-cyan fill-none motion-safe:animate-[tlNodeBreathe_3s_ease-in-out_infinite]"
                strokeWidth={1.5}
              />
            )}
          </g>
        ))}

        {/* Foreground labels — real trades, so the graph reads as THIS market */}
        {NODES.filter((n) => n.label).map((node, index) => (
          <text
            key={`label-${index}`}
            x={node.x}
            y={node.hub ? node.y + 4 : node.y - 12}
            textAnchor="middle"
            className={`fill-muted ${node.hub ? 'fill-accent-foreground' : ''}`}
            style={{ fontSize: node.hub ? '13px' : '12px', fontWeight: node.hub ? 600 : 500 }}
          >
            {node.label}
          </text>
        ))}
      </svg>
    </div>
  )
}
