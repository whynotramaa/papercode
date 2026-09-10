import { useState } from 'react'

type NodeId = 'terminal' | 'loop' | 'boundary' | 'provider'

const NODES: { id: NodeId; label: string; note: string; color: string }[] = [
  { id: 'terminal', label: 'Terminal', note: 'TTY input becomes an explicit UI state.', color: 'blue' },
  { id: 'loop', label: 'Agent loop', note: 'The loop owns streaming, tools, and turn boundaries.', color: 'coral' },
  { id: 'boundary', label: 'Tool boundary', note: 'Permissions and path confinement decide what may run.', color: 'ochre' },
  { id: 'provider', label: 'Provider', note: 'OpenAI-compatible transport stays replaceable.', color: 'sage' },
]

export function SignalPathDiagram() {
  const [active, setActive] = useState<NodeId>('loop')
  const current = NODES.find((node) => node.id === active) ?? NODES[1]

  return (
    <figure className="signal-figure">
      <div className="figure-heading">
        <div><span className="figure-number">FIGURE 01</span><span className="handwritten figure-note">follow the seams</span></div>
        <span className="figure-hint">click a boundary to inspect it</span>
      </div>
      <div className="signal-canvas">
        <svg className="signal-wires" viewBox="0 0 1000 260" preserveAspectRatio="none" aria-hidden="true">
          <path d="M145 130 C250 130 260 130 350 130" />
          <path d="M410 130 C500 130 515 130 605 130" />
          <path d="M665 130 C755 130 770 130 855 130" />
          <path className="wire-branch" d="M505 130 C505 75 505 55 505 30" />
          <circle cx="505" cy="30" r="4" />
        </svg>
        {NODES.map((node, index) => (
          <button
            type="button"
            key={node.id}
            className={`signal-node node-${index + 1} tone-${node.color} ${active === node.id ? 'is-active' : ''}`}
            onClick={() => setActive(node.id)}
            aria-pressed={active === node.id}
          >
            <span className="node-index">0{index + 1}</span>
            <strong>{node.label}</strong>
            <small>{active === node.id ? 'selected' : 'inspect'}</small>
          </button>
        ))}
        <span className="signal-branch-label handwritten">invariants live here</span>
      </div>
      <figcaption>
        <span className="caption-accent">{current.label} /</span> {current.note} The system is readable because each handoff has one owner.
      </figcaption>
    </figure>
  )
}
