import { CodeBlock } from '../components/CodeBlock'
import { TerminalHeightSimulator } from '../components/interactive/TerminalHeightSimulator'
import { Layers, Keyboard, AlertTriangle, CheckCircle2 } from 'lucide-react'

export function TerminalInkSection() {
  return (
    <section id="terminal-ink" className="space-y-12 pt-6 border-t border-[#42433d]">
      {/* Header */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="curly-annotation text-sm text-[#00bae2] font-mono">
            {'{ The Terminal Engine }'}
          </span>
          <span className="text-[#42433d]">&middot;</span>
          <span className="text-xs font-mono text-[#7c7c6f]">Yoga Flexbox &middot; Kitty Keyboard Protocol</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          Why Ink, terminal constraints, and the Kitty protocol
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[#fffce1]/80 max-w-3xl">
          Building a full coding agent in the terminal requires managing character grids, ANSI escape sequences, and keyboard byte streams. PaperCode uses React with Ink to model terminal UI as a declarative state machine while defending against classic terminal rendering traps.
        </p>
      </div>

      {/* Why Ink Card */}
      <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-[#42433d] pb-4">
          <div className="rounded-full border border-[#00bae2]/40 bg-[#00bae2]/10 p-2 text-[#00bae2]">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#fffce1]">
              Why Ink and React for a terminal agent
            </h3>
            <p className="text-xs text-[#7c7c6f]">
              Declarative state trees versus imperative coordinate math
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-xs">
          <div className="space-y-1.5 rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4">
            <div className="font-semibold text-[#00bae2] font-mono">Declarative layout with Yoga</div>
            <p className="text-[#7c7c6f] leading-relaxed">
              Ink compiles standard React JSX trees into Flexbox nodes using Facebook Yoga. Instead of calculating manual column coordinates, components use flexbox boxes with padding and margins.
            </p>
          </div>

          <div className="space-y-1.5 rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4">
            <div className="font-semibold text-[#00bae2] font-mono">Unified input routing</div>
            <p className="text-[#7c7c6f] leading-relaxed">
              Ink provides the useInput hook. PaperCode selectively enables or disables input listeners based on whether the view is active, an approval prompt is blocking, or a stream is running.
            </p>
          </div>

          <div className="space-y-1.5 rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4">
            <div className="font-semibold text-[#00bae2] font-mono">Terminal testing library</div>
            <p className="text-[#7c7c6f] leading-relaxed">
              ink-testing-library lets the test suite render components into virtual terminal frames, assert on text coordinates, and simulate stdin keystrokes without launching real terminals.
            </p>
          </div>
        </div>
      </div>

      {/* The Duplicate Frame Bug */}
      <div className="space-y-4">
        <div className="font-mono text-xs text-[#7c7c6f]">{'{ Render Invariants }'}</div>
        <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          The duplicate frame bug and panel height limits
        </h3>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          In web browsers, tall elements expand the document and trigger scrollbars without corrupting the DOM. In terminals, frames taller than the physical window cause severe rendering corruption.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-[8px] border border-[#ff8709]/50 bg-[#ff8709]/10 p-5 text-xs">
            <div className="flex items-center gap-2 font-semibold text-[#ff8709]">
              <AlertTriangle className="h-4 w-4" />
              <span>How the bug happens</span>
            </div>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-[#fffce1]/90 leading-relaxed">
              <li>Ink renders a frame into a string containing N rows.</li>
              <li>When N exceeds the terminal window height (24 rows), the terminal emulator scrolls down to fit the bottom row.</li>
              <li>The top rows scroll out of the visible screen into the history buffer.</li>
              <li>On the next render, Ink writes ANSI escape code <code className="font-mono text-[#ff8709]">\x1b[NA</code> to move the cursor up by N rows.</li>
              <li>Terminal emulators cannot move the cursor past row zero into the scrollback history buffer.</li>
              <li>The cursor stops at row zero, and Ink prints the new frame below the stranded old one. Each keypress leaves a duplicate ghost frame.</li>
            </ol>
          </div>

          <div className="rounded-[8px] border border-[#0ae448]/40 bg-[#0ae448]/10 p-5 text-xs">
            <div className="flex items-center gap-2 font-semibold text-[#abff84]">
              <CheckCircle2 className="h-4 w-4" />
              <span>PaperCode architectural defense</span>
            </div>
            <ul className="mt-3 space-y-2.5 text-[#fffce1]/90 leading-relaxed">
              <li>
                <strong className="text-[#abff84]">Hard panel cap:</strong> All interactive views (models, sessions, connect walkthrough) have a maximum height limit of 20 rows.
              </li>
              <li>
                <strong className="text-[#abff84]">Dynamic windowing:</strong> <code className="font-mono text-[#abff84]">useViewport()</code> tracks terminal resize events, and <code className="font-mono text-[#abff84]">listCapacity(rows, reserved)</code> slices long lists to display only visible items.
              </li>
              <li>
                <strong className="text-[#abff84]">Static transcript partition:</strong> Finished chat messages mount inside Ink's <code className="font-mono text-[#abff84]">&lt;Static&gt;</code> component, which writes them once to stdout and never recalculates their height.
              </li>
            </ul>
          </div>
        </div>

        {/* Embedded Interactive Terminal Simulator */}
        <TerminalHeightSimulator />
      </div>

      {/* The Static Component and Key Resetting */}
      <div className="space-y-4 pt-4 border-t border-[#42433d]">
        <div className="font-mono text-xs text-[#7c7c6f]">{'{ Static Component Mechanics }'}</div>
        <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          The Static component and composite remount keys
        </h3>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          Ink provides the <code className="rounded-[4px] border border-[#42433d] bg-[#191919] px-1.5 py-0.5 font-mono text-xs text-[#fffce1]">&lt;Static&gt;</code> component to keep historical output out of the active re-render loop. However, Static introduces an internal state trap when switching sessions.
        </p>

        <CodeBlock
          file="src/app.tsx"
          language="tsx"
          code={`{/* Static keeps finished output out of the re-render path; Ink writes it
    once and the terminal owns the scrollback from then on.

    It is append-only: it remembers how many items it has emitted and
    renders only items.slice(thatCount). Replacing the list — which is
    exactly what /new and resuming a session do — would otherwise render
    nothing. Keying it to the session id forces a remount so the counter resets. */}
<Static key={\`\${session.id}:\${epoch}:\${settings.showThinking}\`} items={entries}>
  {(entry, i) => <EntryView key={i} entry={entry} showThinking={settings.showThinking} />}
</Static>`}
        />

        <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-5 text-xs">
          <div className="font-semibold text-[#fffce1]">The composite key mechanism</div>
          <p className="mt-1.5 leading-relaxed text-[#7c7c6f]">
            Static maintains an internal count of emitted items. If you replace the <code className="font-mono text-[#fffce1]">entries</code> array without changing the key, Static checks <code className="font-mono text-[#fffce1]">items.slice(emittedCount)</code>, which evaluates to empty if the new array is shorter or identical in length. By joining <code className="font-mono text-[#fffce1]">session.id</code>, <code className="font-mono text-[#fffce1]">epoch</code>, and <code className="font-mono text-[#fffce1]">settings.showThinking</code> into the key, PaperCode forces React to unmount the old Static node, resetting the internal counter.
          </p>
        </div>
      </div>

      {/* Kitty Keyboard Protocol */}
      <div className="space-y-4 pt-4 border-t border-[#42433d]">
        <div className="flex items-center gap-2">
          <Keyboard className="h-5 w-5 text-[#00bae2]" />
          <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
            The Kitty progressive keyboard protocol
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          Standard Unix TTY drivers transmit the same carriage return byte (ASCII 0x0D, \r) whether Enter is pressed alone or with the Shift key. PaperCode uses progressive keyboard protocol negotiation to support multiline input.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-5 text-xs space-y-2.5">
            <div className="font-semibold text-[#fffce1] font-mono">Protocol activation and detection</div>
            <p className="text-[#7c7c6f] leading-relaxed">
              PaperCode inspects environment variables for Kitty, Ghostty, and WezTerm. When detected, it emits escape sequence <code className="font-mono text-[#00bae2]">\x1b[&gt;1u</code> to enable enhanced key reporting.
            </p>
            <div className="font-mono text-[11px] text-[#7c7c6f] bg-[#0e100f] p-3 rounded-[6px] border border-[#42433d]">
              const KITTY_PUSH = "\x1b[&gt;1u";<br />
              const KITTY_POP = "\x1b[&lt;u";
            </div>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-5 text-xs space-y-2.5">
            <div className="font-semibold text-[#fffce1] font-mono">Fallback for legacy terminals</div>
            <p className="text-[#7c7c6f] leading-relaxed">
              In standard terminals lacking Kitty support, PaperCode maps multiline insertion to <kbd className="rounded-[4px] border border-[#42433d] px-1.5 py-0.5 bg-[#0e100f] font-mono text-[11px] text-[#fffce1]">Ctrl+J</kbd>. Ctrl+J transmits ASCII 0x0A (line feed), which is distinct from Enter (carriage return) in raw terminal mode.
            </p>
            <div className="font-mono text-[11px] text-[#7c7c6f] bg-[#0e100f] p-3 rounded-[6px] border border-[#42433d]">
              newlineKeyLabel() =&gt; supportsKitty ? "Shift+Enter" : "Ctrl+J"
            </div>
          </div>
        </div>

        <div className="rounded-[8px] border border-[#ff8709]/50 bg-[#ff8709]/10 p-5 text-xs">
          <div className="font-semibold text-[#ff8709]">Terminal restoration safety invariant</div>
          <p className="mt-1.5 text-[#fffce1]/90 leading-relaxed">
            If a terminal process exits while Kitty keyboard protocol mode is active, the user's host shell remains trapped in alternate key mode, breaking arrow keys and command entry. PaperCode registers clean-up handlers on <code className="font-mono font-semibold text-[#abff84]">exit</code>, <code className="font-mono font-semibold text-[#abff84]">SIGINT</code>, and <code className="font-mono font-semibold text-[#abff84]">SIGTERM</code> to emit <code className="font-mono">\x1b[&lt;u</code> before process termination.
          </p>
        </div>
      </div>
    </section>
  )
}
