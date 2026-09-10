import { useState } from 'react'
import { CodeBlock } from '../CodeBlock'

interface Layer {
  id: string
  name: string
  subtitle: string
  files: string[]
  invariant: string
  description: string
  code: string
  codeFile: string
}

const LAYERS: Layer[] = [
  {
    id: 'terminal',
    name: 'Terminal hardware & TTY',
    subtitle: 'ANSI sequences, raw mode, Kitty protocol',
    files: ['src/cli.tsx', 'src/ui/keyboard.ts'],
    invariant: 'The process must restore keyboard protocol mode on every exit path (SIGINT, SIGTERM, normal exit) to avoid bricking the shell.',
    description: 'PaperCode starts by validating that stdin is an interactive TTY. It clears the screen buffer, homes the cursor with ANSI escape \\x1b[2J\\x1b[3J\\x1b[H, and pushes Kitty keyboard protocol mode \\x1b[>1u to distinguish Shift+Enter from Enter.',
    codeFile: 'src/cli.tsx',
    code: `ensureDir(configDir());
enableKittyKeyboard();

// Take the whole screen from the first frame.
process.stdout.write("\\x1b[2J\\x1b[3J\\x1b[H");

const restore = () => disableKittyKeyboard();
process.on("exit", restore);
process.on("SIGINT", () => { restore(); process.exit(0); });`,
  },
  {
    id: 'ink',
    name: 'Ink layout & reconciler',
    subtitle: 'Yoga flexbox, bounded panels, Static transcript',
    files: ['src/ui/useViewport.ts', 'src/ui/components/Panel.tsx'],
    invariant: 'Dynamic panel height must stay under 20 rows. Frames exceeding terminal height cannot be erased, causing duplicate panels on every keypress.',
    description: 'Ink renders a tree of React components to text cells using Facebook Yoga. Completed messages mount in <Static>, which writes once to stdout. Active panels calculate list capacity using useViewport() to enforce strict row caps.',
    codeFile: 'src/app.tsx',
    code: `{/* Static keeps finished output out of the re-render path. */}
<Static key={session.id} items={entries}>
  {(entry, i) => <EntryView key={i} entry={entry} />}
</Static>`,
  },
  {
    id: 'app',
    name: 'App state machine & routing',
    subtitle: 'View switching, turn dispatch, approval injection',
    files: ['src/app.tsx', 'src/ui/commands.ts'],
    invariant: 'The UI injects approval prompting into tool execution as a closure, keeping tool implementations completely pure and decoupled from the terminal.',
    description: 'app.tsx coordinates the session state. It tracks active views, holds the current conversation history in a ref, and passes an interactive approval callback into executeTool.',
    codeFile: 'src/app.tsx',
    code: `const requestApproval = useCallback(
  (tool, args) => {
    const target = tool.target?.(args);
    if (approvals.current.has(tool.name, target)) {
      return Promise.resolve(true);
    }
    return waitForUserDecision(tool, args);
  },
  [],
);`,
  },
  {
    id: 'agent',
    name: 'Agent execution loop',
    subtitle: 'SSE stream consumption, tool reassembly, step limits',
    files: ['src/agent/loop.ts', 'src/agent/messages.ts'],
    invariant: 'If a turn is aborted while parallel tool calls are pending, synthetic abortedToolResult messages must answer every uncalled ID to prevent API 400 rejection.',
    description: 'runTurn iterates up to maxSteps, captures text and reasoning deltas, accumulates fragmented tool_calls by index, executes tools sequentially, and preserves prompt validity on cancellation.',
    codeFile: 'src/agent/loop.ts',
    code: `for (const [i, call] of calls.entries()) {
  if (signal.aborted) {
    for (const pending of calls.slice(i)) {
      messages.push(abortedToolResult(pending.id));
    }
    return { reason: "aborted" };
  }
  await executeTool(call);
}`,
  },
  {
    id: 'sandbox',
    name: 'Tool sandbox & permission gate',
    subtitle: 'Plan mode, path escape screening, bash filter',
    files: ['src/tools/permissions.ts', 'src/tools/index.ts'],
    invariant: 'Plan mode gating is enforced at runtime inside executeTool. Removing mutating tools from the schema is an optimization, not the security boundary.',
    description: 'Tools are categorized into read-only, mutating, and dangerous. checkMode blocks mutation in PLAN mode, resolveInRoot prevents traversal, and the shell screen rejects destructive commands.',
    codeFile: 'src/tools/permissions.ts',
    code: `export function checkMode(level: PermissionLevel, mode: Mode) {
  if (mode === "plan" && level !== "read-only") {
    return { allow: false, reason: PLAN_BLOCKED };
  }
  return { allow: true };
}`,
  },
  {
    id: 'storage',
    name: 'Session persistence & config',
    subtitle: 'Atomic writes, POSIX 0600, turn persistence',
    files: ['src/sessions/store.ts', 'src/config/jsonFile.ts'],
    invariant: 'JSON files are written to a process-unique temp file and renamed into place, guaranteeing crashes never produce truncated or corrupted JSON.',
    description: 'PaperCode stores human-inspectable JSON in ~/.papercode/. Sessions persist at turn boundaries, while provider keys in auth.json use owner-only permissions.',
    codeFile: 'src/config/jsonFile.ts',
    code: `const tmp = \`\${file}.\${process.pid}.tmp\`;
fs.writeFileSync(tmp, JSON.stringify(data) + "\\n");
fs.renameSync(tmp, file);`,
  },
  {
    id: 'provider',
    name: 'Provider client & discovery',
    subtitle: 'OpenAI SDK, chat filtering, heuristic ranking',
    files: ['src/providers/client.ts', 'src/providers/models.ts'],
    invariant: 'The SDK client sets maxRetries to 0 so the terminal UI controls retry states, preventing hidden freezes mid-stream.',
    description: 'PaperCode targets any OpenAI-compatible endpoint. fetchModels filters embeddings and audio models, then sorts reasoning and coding models to the top.',
    codeFile: 'src/providers/models.ts',
    code: `export function isChatModel(id: string): boolean {
  return !NON_CHAT.test(id);
}

function rank(id: string): number {
  if (/gpt-5|claude-opus/i.test(id)) return 0;
  return 1;
}`,
  },
]

export function ArchitectureExplorer() {
  const [selectedId, setSelectedId] = useState(LAYERS[0].id)
  const current = LAYERS.find((layer) => layer.id === selectedId) ?? LAYERS[0]
  const currentIndex = LAYERS.findIndex((layer) => layer.id === current.id)

  return (
    <figure className="architecture-explorer">
      <header className="architecture-heading">
        <div>
          <span className="figure-number">FIGURE 02 / SYSTEM MAP</span>
          <h3>Seven boundaries, one readable system.</h3>
        </div>
        <span className="handwritten architecture-note">trace the handoffs ↗</span>
      </header>

      <div className="architecture-map">
        <nav className="stack-list" aria-label="Architecture layers">
          {LAYERS.map((layer, index) => (
            <button
              type="button"
              key={layer.id}
              className={`stack-layer tone-${index % 4} ${layer.id === current.id ? 'is-active' : ''}`}
              onClick={() => setSelectedId(layer.id)}
              aria-pressed={layer.id === current.id}
            >
              <span className="stack-number">0{index + 1}</span>
              <span className="stack-copy"><strong>{layer.name}</strong><small>{layer.subtitle}</small></span>
              <span className="stack-arrow">↗</span>
            </button>
          ))}
        </nav>

        <article className={`architecture-detail tone-${currentIndex % 4}`}>
          <div className="detail-meta"><span>BOUNDARY 0{currentIndex + 1}</span><span>{current.files.join(' · ')}</span></div>
          <h4>{current.name}</h4>
          <p>{current.description}</p>
          <div className="invariant-note">
            <span>LOAD-BEARING INVARIANT</span>
            <p>{current.invariant}</p>
          </div>
          <CodeBlock file={current.codeFile} code={current.code} language="typescript" />
        </article>
      </div>

      <figcaption><span>FIGURE 02</span> Select a layer to move through the system from physical input to provider transport.</figcaption>
    </figure>
  )
}
