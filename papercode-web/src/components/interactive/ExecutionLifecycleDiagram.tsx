import { useState } from 'react'

const STEPS = [
  ['01', 'receive', 'User message enters the turn.'],
  ['02', 'stream', 'Text and tool fragments arrive.'],
  ['03', 'decide', 'The loop checks the next invariant.'],
  ['04', 'execute', 'A permitted tool runs in the workspace.'],
  ['05', 'record', 'Results become valid history.'],
] as const

export function ExecutionLifecycleDiagram() {
  const [step, setStep] = useState(2)
  const current = STEPS[step]

  return (
    <figure className="lifecycle-figure">
      <div className="figure-heading">
        <div><span className="figure-number">FIGURE 04</span><span className="handwritten figure-note">one turn, many checks</span></div>
        <span className="figure-hint">select a phase</span>
      </div>
      <div className="lifecycle-track" role="list" aria-label="Agent turn lifecycle">
        {STEPS.map(([number, label], index) => (
          <button
            type="button"
            role="listitem"
            key={label}
            className={`lifecycle-step ${index === step ? 'is-active' : ''} ${index < step ? 'is-complete' : ''}`}
            onClick={() => setStep(index)}
          >
            <span>{number}</span><strong>{label}</strong>
          </button>
        ))}
      </div>
      <div className="lifecycle-readout">
        <span className="readout-arrow">↳</span>
        <span><b>{current[1]}</b> — {current[2]}</span>
      </div>
    </figure>
  )
}
