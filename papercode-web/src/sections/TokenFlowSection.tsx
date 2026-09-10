import { Badge } from '../components/Badge'
import { CodeBlock } from '../components/CodeBlock'
import { TokenFlowSimulator } from '../components/interactive/TokenFlowSimulator'
import { ShieldAlert } from 'lucide-react'

export function TokenFlowSection() {
  return (
    <section id="token-flow" className="space-y-12 pt-6 border-t border-[#42433d]">
      {/* Header */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="curly-annotation text-sm text-[#9d95ff] font-mono">
            {'{ Wire Protocols & Token Flow }'}
          </span>
          <span className="text-[#42433d]">&middot;</span>
          <span className="text-xs font-mono text-[#7c7c6f]">SSE Streams &middot; Tool Call Fragments &middot; Invariant Defense</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          How tokens travel to the LLM and their wire shapes
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[#fffce1]/80 max-w-3xl">
          Large language models do not consume or return plain strings. PaperCode transforms keystrokes into structured chat completion payloads, parses incoming Server-Sent Events, reconstructs fragmented function calls, and guards against protocol desynchronization.
        </p>
      </div>

      {/* The Prompt Assembly Pipeline */}
      <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#42433d] pb-4">
          <div>
            <h3 className="text-lg font-semibold text-[#fffce1]">
              System prompt composition
            </h3>
            <p className="text-xs text-[#7c7c6f]">
              How PaperCode prepares context before sending the first token
            </p>
          </div>
          <Badge variant="lilac">src/agent/systemPrompt.ts</Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 font-mono text-xs">
          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4 space-y-1.5">
            <div className="font-semibold text-[#00bae2]">1. Base Guidelines</div>
            <p className="text-[11px] font-sans text-[#7c7c6f] leading-relaxed">
              Conciseness rules, instruction to read before editing, and preference for edit over write.
            </p>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4 space-y-1.5">
            <div className="font-semibold text-[#ff8709]">2. Mode Directives</div>
            <p className="text-[11px] font-sans text-[#7c7c6f] leading-relaxed">
              Injects PLAN note (read-only) or BUILD note, instructing the model which tools exist.
            </p>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4 space-y-1.5">
            <div className="font-semibold text-[#fffce1]">3. Environment Context</div>
            <p className="text-[11px] font-sans text-[#7c7c6f] leading-relaxed">
              Working directory path, host platform, OS kernel release, and ISO calendar date.
            </p>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4 space-y-1.5">
            <div className="font-semibold text-[#9d95ff]">4. User Overrides</div>
            <p className="text-[11px] font-sans text-[#7c7c6f] leading-relaxed">
              Appends custom instructions from ~/.papercode/settings.json with explicit priority.
            </p>
          </div>
        </div>

        <CodeBlock
          file="src/agent/systemPrompt.ts"
          language="typescript"
          code={`export function buildSystemPrompt(mode: Mode, cwd = process.cwd()): string {
  const settings = loadSettings();

  const env = [
    \`Working directory: \${cwd}\`,
    \`Platform: \${process.platform}\`,
    \`OS: \${os.release()}\`,
    \`Date: \${new Date().toISOString().slice(0, 10)}\`,
  ].join("\\n");

  const parts = [BASE, mode === "plan" ? PLAN_NOTE : BUILD_NOTE, \`\\nEnvironment:\\n\${env}\`];

  if (settings.systemPrompt?.trim()) {
    parts.push(\`\\nUser instructions (these take priority):\\n\${settings.systemPrompt.trim()}\`);
  }

  return parts.join("\\n");
}`}
        />
      </div>

      {/* SSE Streaming & Tool Fragment Assembly */}
      <div className="space-y-4">
        <div className="font-mono text-xs text-[#7c7c6f]">{'{ Stream Assembly Mechanics }'}</div>
        <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          SSE delta stream consumption and partial tool reassembly
        </h3>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          When an LLM invokes tools over a streaming connection, the arguments do not arrive as a single JSON payload. Instead, argument strings arrive character-by-character across multiple HTTP Server-Sent Event chunks.
        </p>

        <CodeBlock
          file="src/agent/loop.ts"
          language="typescript"
          highlightLines={[13, 14, 15, 16, 17, 18, 19, 20]}
          code={`const partials = new Map<number, PartialToolCall>();

for await (const chunk of stream) {
  const choice = chunk.choices[0];
  if (!choice) continue;
  const delta = choice.delta;

  const reasoning = reasoningDelta(delta);
  if (reasoning) onEvent({ type: "thinking", delta: reasoning });

  if (typeof delta?.content === "string" && delta.content.length > 0) {
    text += delta.content;
    onEvent({ type: "text", delta: delta.content });
  }

  // Tool calls stream in fragments keyed by index: the id and name usually
  // arrive once in the first fragment, then arguments accrete character by
  // character across later ones.
  for (const tc of delta?.tool_calls ?? []) {
    const slot = partials.get(tc.index) ?? { id: "", name: "", args: "" };
    if (tc.id) slot.id = tc.id;
    if (tc.function?.name) slot.name += tc.function.name;
    if (tc.function?.arguments) slot.args += tc.function.arguments;
    partials.set(tc.index, slot);
  }
}`}
        />

        {/* Embedded Interactive Token Flow Simulator */}
        <TokenFlowSimulator />
      </div>

      {/* The Dangling Tool Call Trap */}
      <div className="space-y-4 pt-4 border-t border-[#42433d]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-[#ff8709]" />
          <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
            The dangling tool call trap
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          The OpenAI Chat Completion specification enforces a strict transactional rule. If an assistant message contains a <code className="font-mono text-xs text-[#abff84]">tool_calls</code> array, every ID in that array must have an immediate matching response message with <code className="font-mono text-xs text-[#abff84]">role: "tool"</code>.
        </p>

        <div className="rounded-[8px] border border-[#ff8709]/50 bg-[#ff8709]/10 p-5 text-xs">
          <div className="font-semibold text-[#ff8709]">
            How naive implementations break on abort
          </div>
          <p className="mt-1.5 leading-relaxed text-[#fffce1]/90">
            Imagine the model requests two tool calls in parallel: <code className="font-mono text-xs">call_1</code> (read) and <code className="font-mono text-xs">call_2</code> (write). After <code className="font-mono text-xs">call_1</code> executes, the user presses Escape to interrupt. If the agent loop immediately exits, the conversation history contains an assistant message requesting both calls, but only a tool message for <code className="font-mono text-xs">call_1</code>. The very next user turn will fail with HTTP 400: "Invalid parameter: messages with role 'tool' must follow assistant messages with 'tool_calls'".
          </p>
        </div>

        <CodeBlock
          file="src/agent/loop.ts"
          language="typescript"
          highlightLines={[2, 3, 4, 5, 6, 7]}
          code={`for (const [i, call] of calls.entries()) {
  if (signal.aborted) {
    // Every remaining call still needs a result message or the next request
    // is rejected for an unanswered tool_call id.
    for (const pending of calls.slice(i)) messages.push(abortedToolResult(pending.id));
    onEvent({ type: "turn_end", reason: "aborted" });
    return { reason: "aborted" };
  }
  // Execute tool...
}`}
        />

        <CodeBlock
          file="src/agent/messages.ts"
          language="typescript"
          code={`export function abortedToolResult(id: string): ChatMessage {
  return {
    role: "tool",
    tool_call_id: id,
    content: "Interrupted by the user before this tool finished.",
  };
}`}
        />
      </div>
    </section>
  )
}
