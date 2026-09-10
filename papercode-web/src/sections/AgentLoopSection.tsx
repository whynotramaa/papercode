import { Badge } from '../components/Badge'
import { CodeBlock } from '../components/CodeBlock'
import { ExecutionLifecycleDiagram } from '../components/interactive/ExecutionLifecycleDiagram'

export function AgentLoopSection() {
  return (
    <section id="agent-loop" className="space-y-12 pt-6 border-t border-[#42433d]">
      {/* Header */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="curly-annotation text-sm text-[#0ae448] font-mono">
            {'{ Execution Engine }'}
          </span>
          <span className="text-[#42433d]">&middot;</span>
          <span className="text-xs font-mono text-[#7c7c6f]">Multi-step Turns &middot; Abort Signals &middot; Approval Injection</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          The agent loop and turn lifecycle
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[#fffce1]/80 max-w-3xl">
          The agent loop coordinates streaming completions, step limits, tool execution, and user interruptions. PaperCode decouples the loop from both the terminal UI and specific model vendors, allowing comprehensive unit testing against mock providers.
        </p>
      </div>

      <ExecutionLifecycleDiagram />

      {/* Anatomy of runTurn */}
      <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#42433d] pb-4">
          <div>
            <h3 className="text-lg font-semibold text-[#fffce1]">
              The multi-step turn loop
            </h3>
            <p className="text-xs text-[#7c7c6f]">
              How PaperCode executes up to maxSteps (default 25) per user message
            </p>
          </div>
          <Badge variant="green">src/agent/loop.ts</Badge>
        </div>

        <p className="text-xs leading-relaxed text-[#fffce1]/90">
          When the user submits a message, the model may respond with text, tool calls, or both. If the model emits tool calls, the agent loop executes them, appends their outputs as tool messages, and loops back to query the model with the updated conversation history. This cycle repeats until the model produces a final text answer or reaches the step limit.
        </p>

        <CodeBlock
          file="src/agent/loop.ts"
          language="typescript"
          highlightLines={[3, 4, 18, 19, 20, 21]}
          code={`export async function runTurn(opts: RunTurnOptions): Promise<TurnResult> {
  const { client, model, messages, tools, executeTool, signal, onEvent } = opts;
  const maxSteps = opts.maxSteps ?? 25;

  for (let step = 0; step < maxSteps; step++) {
    if (signal.aborted) {
      onEvent({ type: "turn_end", reason: "aborted" });
      return { reason: "aborted" };
    }

    let text = "";
    const partials = new Map<number, PartialToolCall>();

    // 1. Stream chat completion
    // 2. Accumulate deltas and tool calls
    // 3. If no calls emitted, finish turn
    if (calls.length === 0) {
      messages.push({ role: "assistant", content: text });
      onEvent({ type: "turn_end", reason: "done" });
      return { reason: "done" };
    }

    // 4. Record assistant tool_calls in message history
    messages.push({ role: "assistant", content: text || null, tool_calls: calls });

    // 5. Execute each tool call sequentially
    for (const [i, call] of calls.entries()) {
      // Handle aborts and run tool...
    }
  }

  onEvent({ type: "turn_end", reason: "max_steps" });
  return { reason: "max_steps" };
}`}
        />
      </div>

      {/* The Fast Response Edge Case */}
      <div className="space-y-4">
        <div className="font-mono text-xs text-[#7c7c6f]">{'{ Timing Invariants }'}</div>
        <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          The fast response abort race condition
        </h3>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          Streaming networks contain asynchronous timing races. A fast model, or a local provider like Ollama running on loopback, can finish delivering an entire completion before the user's Escape keypress dispatches through Node's event loop.
        </p>

        <div className="rounded-[8px] border border-[#ff8709]/50 bg-[#ff8709]/10 p-5 text-xs">
          <div className="font-semibold text-[#ff8709]">The stream drain trap</div>
          <p className="mt-1.5 leading-relaxed text-[#fffce1]/90">
            If the code only checks <code className="font-mono text-[#fffce1]">signal.aborted</code> inside the stream reader loop, a stream that drained completely just milliseconds before the interrupt was processed will report success. The loop would then proceed to execute mutating tool calls that the user explicitly attempted to cancel.
          </p>
        </div>

        <CodeBlock
          file="src/agent/loop.ts"
          language="typescript"
          highlightLines={[3, 4, 5, 6, 7]}
          code={`// The stream can drain before an abort takes effect — a fast response, or a
// provider that flushes everything at once. Without this check the turn
// reports "done" and proceeds to run tool calls the user just interrupted.
if (signal.aborted) {
  if (text) messages.push({ role: "assistant", content: text });
  onEvent({ type: "turn_end", reason: "aborted" });
  return { reason: "aborted" };
}`}
        />
      </div>

      {/* Approval Injection Architecture */}
      <div className="space-y-4 pt-4 border-t border-[#42433d]">
        <div className="font-mono text-xs text-[#7c7c6f]">{'{ Dependency Decoupling }'}</div>
        <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          Approval prompting via dependency injection
        </h3>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          A common mistake in CLI agent architecture is importing terminal UI libraries directly into tool implementations. This makes tools impossible to unit test without mocking an interactive terminal.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
          <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-5 space-y-2">
            <div className="font-semibold text-[#00bae2] font-mono">Pure tool contracts</div>
            <p className="text-[#7c7c6f] leading-relaxed">
              Tools implement a simple async signature: <code className="font-mono text-[11px] text-[#fffce1]">run(args, ctx): Promise&lt;ToolResult&gt;</code>. They have zero awareness of React, Ink, or user dialogs.
            </p>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-5 space-y-2">
            <div className="font-semibold text-[#abff84] font-mono">UI closure injection</div>
            <p className="text-[#7c7c6f] leading-relaxed">
              <code className="font-mono text-[11px] text-[#fffce1]">app.tsx</code> provides an approval closure to <code className="font-mono text-[11px] text-[#fffce1]">executeTool</code>. When a mutating tool runs, this closure renders the <code className="font-mono text-[11px] text-[#fffce1]">&lt;ApprovalPrompt&gt;</code> component and returns a Promise that resolves when the user presses 1, 2, 3, or Enter.
            </p>
          </div>
        </div>

        <CodeBlock
          file="src/tools/permissions.ts"
          language="typescript"
          code={`export class ApprovalStore {
  private granted = new Set<string>();
  private blanketEdits = false;

  key(tool: string, target?: string): string {
    return target ? \`\${tool}::\${target}\` : tool;
  }

  has(tool: string, level: PermissionLevel, target?: string): boolean {
    if (this.blanketEdits && level === "mutating") return true;
    return this.granted.has(this.key(tool, target));
  }

  grant(tool: string, target?: string): void {
    this.granted.add(this.key(tool, target));
  }

  grantAllEdits(): void {
    this.blanketEdits = true;
  }

  clear(): void {
    this.granted.clear();
    this.blanketEdits = false;
  }
}`}
        />
      </div>
    </section>
  )
}
