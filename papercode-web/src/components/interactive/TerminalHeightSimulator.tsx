import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'

type Mode = 'unbounded' | 'bounded'

const TERMINAL_LINES = [
  'select model',
  '> gpt-4o',
  '  claude-3-5-sonnet',
  '  deepseek-reasoner',
  '  qwen-2.5-coder',
  '  llama-3.3-70b',
  '  mistral-large',
  '  gemini-1.5-pro',
]

export function TerminalHeightSimulator() {
  const [mode, setMode] = useState<Mode>('unbounded')
  const [frameHeight, setFrameHeight] = useState(28)
  const [redraws, setRedraws] = useState(1)
  const viewportRows = 24
  const effectiveHeight = mode === 'bounded' ? Math.min(frameHeight, 20) : frameHeight
  const overflows = effectiveHeight > viewportRows
  const ghostFrames = mode === 'unbounded' && overflows ? Math.min(redraws - 1, 3) : 0
  const status = overflows ? 'cursor-up fails' : 'repaints in place'

  const frameStyle = useMemo(() => ({ '--frame-rows': `${effectiveHeight}` } as CSSProperties), [effectiveHeight])

  const redraw = () => setRedraws((count) => Math.min(count + 1, 9))
  const reset = () => setRedraws(1)

  return (
    <figure className="redraw-figure">
      <header className="figure-heading redraw-heading">
        <div>
          <span className="figure-number">FIGURE 03 / TERMINAL REDRAW</span>
          <h3>When a frame becomes taller than the window.</h3>
        </div>
        <span className="handwritten figure-note">press it again ↻</span>
      </header>

      <div className="redraw-toolbar">
        <div className="redraw-modes" role="group" aria-label="Redraw mode">
          <button type="button" className={mode === 'unbounded' ? 'is-active is-danger' : ''} onClick={() => { setMode('unbounded'); setRedraws(1) }}>unbounded</button>
          <button type="button" className={mode === 'bounded' ? 'is-active is-safe' : ''} onClick={() => { setMode('bounded'); setRedraws(1) }}>PaperCode bounded</button>
        </div>
        <button type="button" className="redraw-action" onClick={redraw}>simulate keypress <span>#{redraws}</span></button>
        <button type="button" className="redraw-reset" onClick={reset} aria-label="Reset simulation"><RefreshCw size={13} /></button>
      </div>

      <div className="redraw-controls">
        <label>
          <span>frame height <output>{frameHeight} rows</output></span>
          <input type="range" min="12" max="32" value={frameHeight} onChange={(event) => { setFrameHeight(Number(event.target.value)); setRedraws(1) }} />
        </label>
        <label>
          <span>terminal window <output>{viewportRows} rows</output></span>
          <input type="range" min="18" max="30" value={viewportRows} readOnly aria-label="Terminal window is fixed at 24 rows" />
        </label>
      </div>

      <div className="redraw-stage">
        <div className="terminal-simulation" aria-live="polite">
          <div className="terminal-topline"><span>tty0 / 80×24</span><span className={overflows ? 'status-danger' : 'status-safe'}>{status}</span></div>
          <div className="terminal-window">
            {Array.from({ length: ghostFrames }, (_, index) => (
              <div className="ghost-frame" key={index}><span>ghost frame #{index + 1}</span><small>scrollback / stranded</small></div>
            ))}
            <div className={`active-terminal-frame ${overflows ? 'is-overflowing' : 'is-safe'}`} style={frameStyle}>
              <div className="frame-label"><span>active frame #{redraws}</span><span>{effectiveHeight} rows</span></div>
              <div className="terminal-lines">
                {TERMINAL_LINES.map((line, index) => <span key={index} className={index === 1 ? 'selected-line' : ''}>{line}</span>)}
                <span className="terminal-fade">··· {Math.max(effectiveHeight - TERMINAL_LINES.length - 3, 0)} more rows</span>
              </div>
            </div>
          </div>
        </div>

        <aside className={`redraw-readout ${overflows ? 'is-danger' : 'is-safe'}`}>
          {overflows ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <div>
            <strong>{overflows ? 'The scrollback trap' : 'Safe to repaint'}</strong>
            <p>{overflows ? `The ${effectiveHeight}-row frame pushes the cursor into scrollback. After ${redraws} redraw${redraws === 1 ? '' : 's'}, ${ghostFrames || 'the'} old frame${ghostFrames === 1 ? ' is' : 's are'} stranded.` : `The active panel stays within the terminal window. Ink can move the cursor up ${effectiveHeight} rows and redraw the same space.`}</p>
          </div>
        </aside>
      </div>

      <figcaption><span>INTERACTIVE NOTE</span> Drag the frame height past 24 rows, then simulate another keypress. Bounded mode applies the MAX_ROWS = 20 defense.</figcaption>
    </figure>
  )
}
