import { CodeBlock } from '../components/CodeBlock'
import { CompactionVisualizer } from '../components/interactive/CompactionVisualizer'
import { FileText, Database } from 'lucide-react'

export function CompactionSection() {
  return (
    <section id="compaction" className="space-y-12 pt-6 border-t border-[#42433d]">
      {/* Header */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="curly-annotation text-sm text-[#fec5fb] font-mono">
            {'{ Context Compaction }'}
          </span>
          <span className="text-[#42433d]">&middot;</span>
          <span className="text-xs font-mono text-[#7c7c6f]">Safe Split Algorithm &middot; Token Heuristics &middot; Epoch Bumping</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          Context compaction and the safe split index
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[#fffce1]/80 max-w-3xl">
          As coding conversations grow, accumulated file contents and tool outputs saturate the LLM context window. PaperCode automatically summarizes earlier turns to recover token room while preserving recent continuity and strictly protecting tool transaction boundaries.
        </p>
      </div>

      {/* Threshold and Token Estimation */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-6 space-y-3">
          <div className="flex items-center gap-2 text-[#00bae2]">
            <Database className="h-5 w-5" />
            <h3 className="text-base font-semibold text-[#fffce1]">
              Capacity threshold monitoring
            </h3>
          </div>
          <p className="text-xs text-[#7c7c6f] leading-relaxed">
            PaperCode assumes a default 128,000 token context limit. When token volume passes 80% capacity (102,400 tokens), the interface prompts the user to compact, or triggers automatically. Users can also trigger compaction at any time using the /compact command.
          </p>
          <div className="font-mono text-[11px] text-[#7c7c6f] bg-[#0e100f] p-3 rounded-[6px] border border-[#42433d]">
            const ASSUMED_CONTEXT = 128_000;<br />
            const COMPACT_AT = 0.8;
          </div>
        </div>

        <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-6 space-y-3">
          <div className="flex items-center gap-2 text-[#fec5fb]">
            <FileText className="h-5 w-5" />
            <h3 className="text-base font-semibold text-[#fffce1]">
              Token estimation without native BPE
            </h3>
          </div>
          <p className="text-xs text-[#7c7c6f] leading-relaxed">
            Full byte-pair encoding libraries like tiktoken introduce native C++ compilation dependencies that complicate cross-platform installation. PaperCode uses a lightweight 4-character division heuristic across content strings and tool call serializations.
          </p>
          <CodeBlock
            file="src/agent/compact.ts"
            language="typescript"
            code={`export function estimateTokens(messages: ChatMessage[]): number {
  let chars = 0;
  for (const m of messages) {
    const content = (m as { content?: unknown }).content;
    if (typeof content === "string") chars += content.length;
    else if (Array.isArray(content)) chars += JSON.stringify(content).length;
    const calls = (m as { tool_calls?: unknown }).tool_calls;
    if (calls) chars += JSON.stringify(calls).length;
  }
  return Math.ceil(chars / 4);
}`}
          />
        </div>
      </div>

      {/* The Safe Split Index Algorithm */}
      <div className="space-y-4">
        <div className="font-mono text-xs text-[#7c7c6f]">{'{ Transaction Boundary Invariant }'}</div>
        <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          The safe split index algorithm
        </h3>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          When compacting, we want to retain the most recent turns (default 6 messages) and summarize the rest. However, a naive slice like <code className="font-mono text-xs text-[#abff84]">messages.slice(-6)</code> can slice directly through the middle of an assistant tool call transaction.
        </p>

        <CodeBlock
          file="src/agent/compact.ts"
          language="typescript"
          highlightLines={[4, 5, 6, 7, 8, 9, 10]}
          code={`export function safeSplitIndex(messages: ChatMessage[], preferred: number): number {
  let i = Math.max(0, Math.min(preferred, messages.length));

  while (i > 0) {
    const here = messages[i];
    const before = messages[i - 1];
    const landsOnOrphan = here !== undefined && isToolResult(here);
    const splitsACall = before !== undefined && hasToolCalls(before);
    if (!landsOnOrphan && !splitsACall) break;
    i--;
  }

  return i;
}`}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
          <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-5 space-y-1.5">
            <div className="font-semibold text-[#fec5fb] font-mono">Condition 1: landsOnOrphan</div>
            <p className="text-[#7c7c6f] leading-relaxed">
              If message <code className="font-mono text-[#fffce1]">i</code> has role "tool", cutting here would make the kept history begin with an orphan tool result without its preceding assistant call. The loop steps back.
            </p>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-5 space-y-1.5">
            <div className="font-semibold text-[#fec5fb] font-mono">Condition 2: splitsACall</div>
            <p className="text-[#7c7c6f] leading-relaxed">
              If message <code className="font-mono text-[#fffce1]">i - 1</code> is an assistant message containing <code className="font-mono text-[#fffce1]">tool_calls</code>, cutting here would put the tool calls in the summarized section and their results in the kept section. The loop steps back.
            </p>
          </div>
        </div>

        {/* Embedded Interactive Compaction Visualizer */}
        <CompactionVisualizer />
      </div>

      {/* Epoch Bumping & Screen Reset */}
      <div className="space-y-4 pt-4 border-t border-[#42433d]">
        <div className="font-mono text-xs text-[#7c7c6f]">{'{ Static Component Synchronization }'}</div>
        <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          Epoch bumping and Static transcript replacement
        </h3>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          Once the summary is generated, the on-screen terminal transcript no longer matches the message array the model sees. Leaving the full transcript visible would mislead the user about what context remains active.
        </p>

        <CodeBlock
          file="src/app.tsx"
          language="typescript"
          code={`// The transcript above no longer matches the history the model sees, so
// it goes — screen and scrollback both — and the receipt becomes the
// whole transcript. Replacing the list needs the epoch bump to reprint.
clearScreen();
setEntries([{ kind: "compaction", summarized: result.summarized, before, after }]);
setEpoch((e) => e + 1);
persist();`}
        />

        <p className="text-xs text-[#7c7c6f] leading-relaxed max-w-3xl">
          The <code className="font-mono text-xs text-[#abff84]">clearScreen()</code> function sends ANSI escape sequence <code className="font-mono text-xs text-[#abff84]">\x1b[2J\x1b[3J\x1b[H</code> to clear visible rows and scrollback. Bumping the <code className="font-mono text-xs text-[#abff84]">epoch</code> counter updates the composite key on the <code className="font-mono text-xs text-[#abff84]">&lt;Static&gt;</code> component, resetting its internal index and rendering a clean Compaction Receipt showing characters and tokens saved.
        </p>
      </div>
    </section>
  )
}
