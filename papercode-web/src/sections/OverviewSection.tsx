import { ArchitectureExplorer } from '../components/interactive/ArchitectureExplorer'
import { SignalPathDiagram } from '../components/interactive/SignalPathDiagram'

export function OverviewSection() {
  return (
    <section id="overview" className="overview-section">
      <header className="article-header">
        <div className="eyebrow"><span>ENGINEERING / SYSTEMS</span><span>ISSUE 001</span></div>
        <h1>Code agent,<br /><em>built for the terminal.</em></h1>
        <p className="dek">A technical investigation into the boundaries that make PaperCode predictable: terminal rendering, durable state, streaming protocols, and security.</p>
        <div className="byline">
          <span>Rama</span><span>September 2026</span><span>18 min read</span>
        </div>
        <span className="handwritten hero-note">notes from the edge of the stack ↗</span>
      </header>

      <div className="header-rule" />

      <div className="intro-grid">
        <div className="section-marker">00 / ABSTRACT</div>
        <div className="prose intro-copy">
          <p className="lead">PaperCode is a terminal coding agent built with React and Ink that operates against any OpenAI-compatible provider.</p>
          <p>Its interesting problems are not the obvious ones. They live at the seams: a terminal is a character grid, an LLM speaks in partial messages, a session must survive a power loss, and a tool must never escape its workspace.</p>
        </div>
      </div>

      <div className="principles" aria-label="Engineering principles">
        <div><span>01</span><strong>Terminal first</strong><p>Bounded frames, static transcripts, and explicit keyboard protocols.</p></div>
        <div><span>02</span><strong>Invariants over optimism</strong><p>Abort paths and transaction boundaries are part of the design.</p></div>
        <div><span>03</span><strong>Inspectable state</strong><p>Plain files, atomic writes, and errors that explain what to do next.</p></div>
        <div><span>04</span><strong>Defence in depth</strong><p>Prompt filtering is useful; runtime gates are the boundary.</p></div>
      </div>

      <SignalPathDiagram />
      <ArchitectureExplorer />

      <div className="article-subsection">
        <div className="section-marker">THE MENTAL MODEL</div>
        <h2>Make the boundaries explicit.</h2>
        <p className="measure">Many agent frameworks entangle terminal display logic with LLM networking and file modification. PaperCode decouples these concerns into explicit boundaries that can be inspected, tested, and reasoned about independently.</p>
        <div className="document-diagram" role="img" aria-label="PaperCode architecture flow from terminal to tools and providers">
          <div className="diagram-row"><span>User terminal</span><i>TTY · ANSI · Kitty</i></div>
          <div className="diagram-line">↓</div>
          <div className="diagram-row"><span>React / Ink application</span><i>state · routing · approvals</i></div>
          <div className="diagram-line">↓</div>
          <div className="diagram-split"><div><span>Agent loop</span><i>SSE · tools · history</i></div><div><span>Persistence</span><i>JSON · atomic rename</i></div></div>
          <div className="diagram-line">↓　　　　　　　　　↓</div>
          <div className="diagram-split"><div><span>Tools & sandbox</span><i>permissions · paths</i></div><div><span>Provider client</span><i>OpenAI-compatible</i></div></div>
        </div>
      </div>

      <div className="article-subsection tradeoffs">
        <div className="section-marker">ENGINEERING JUSTIFICATIONS</div>
        <h2>Decisions that keep the system legible.</h2>
        <p className="measure">Every layer prioritizes predictability, inspectability, and testability without requiring a desktop environment or background daemon.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Decision</th><th>PaperCode approach</th><th>Why it holds</th></tr></thead>
            <tbody>
              <tr><td>UI framework</td><td>Ink 5 + React 18</td><td>Declarative state machines without manual coordinate math.</td></tr>
              <tr><td>Session persistence</td><td>Atomic JSON files</td><td>Readable with standard shell tools; no native database bindings.</td></tr>
              <tr><td>API retries</td><td>maxRetries: 0</td><td>Silent backoff looks like a frozen terminal.</td></tr>
              <tr><td>Plan mode</td><td>Prompt + runtime gate</td><td>Models can hallucinate tools; the executor cannot bypass its guard.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
