import { Badge } from '../components/Badge'
import { CodeBlock } from '../components/CodeBlock'
import { HardDrive } from 'lucide-react'

export function SessionStorageSection() {
  return (
    <section id="session-storage" className="space-y-12 pt-6 border-t border-[#42433d]">
      {/* Header */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="curly-annotation text-sm text-[#abff84] font-mono">
            {'{ Persistence & Disk Storage }'}
          </span>
          <span className="text-[#42433d]">&middot;</span>
          <span className="text-xs font-mono text-[#7c7c6f]">POSIX 0600 &middot; Atomic Rename</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          How sessions and configuration persist on disk
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[#fffce1]/80 max-w-3xl">
          CLI applications cannot use browser APIs like localStorage or IndexedDB. PaperCode implements an atomic, filesystem-based storage engine that guarantees zero corruption on unexpected process exits.
        </p>
      </div>

      {/* Directory Layout Card */}
      <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-[#42433d] pb-4">
          <div className="rounded-full border border-[#abff84]/40 bg-[#abff84]/10 p-2 text-[#abff84]">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#fffce1]">
              Storage layout in ~/.papercode/
            </h3>
            <p className="text-xs text-[#7c7c6f]">
              Transparent, human-readable JSON files inspectable with standard shell tools
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 font-mono text-xs">
          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4 space-y-2">
            <div className="flex items-center justify-between text-[#fffce1] font-semibold">
              <span>auth.json</span>
              <Badge variant="orange">0o600</Badge>
            </div>
            <p className="text-[11px] text-[#7c7c6f] font-sans leading-relaxed">
              API keys and base URLs. Saved with owner-only read and write permissions to prevent credential exposure.
            </p>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4 space-y-2">
            <div className="flex items-center justify-between text-[#fffce1] font-semibold">
              <span>settings.json</span>
              <Badge variant="neutral">Config</Badge>
            </div>
            <p className="text-[11px] text-[#7c7c6f] font-sans leading-relaxed">
              Active provider name, selected model identifier, active UI theme, and custom system prompt overrides.
            </p>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4 space-y-2">
            <div className="flex items-center justify-between text-[#fffce1] font-semibold">
              <span>skills.json</span>
              <Badge variant="neutral">Global</Badge>
            </div>
            <p className="text-[11px] text-[#7c7c6f] font-sans leading-relaxed">
              Global custom prompt commands available across all projects. Overridden by project-local .papercode/skills.json.
            </p>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4 space-y-2">
            <div className="flex items-center justify-between text-[#abff84] font-semibold">
              <span>sessions/*.json</span>
              <Badge variant="green">State</Badge>
            </div>
            <p className="text-[11px] text-[#7c7c6f] font-sans leading-relaxed">
              One JSON file per conversation, containing full message history, timestamps, working directory, and metadata.
            </p>
          </div>
        </div>
      </div>

      {/* Atomic File Writes */}
      <div className="space-y-4">
        <div className="font-mono text-xs text-[#7c7c6f]">{'{ Atomic File I/O }'}</div>
        <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          Atomic file writes and corruption prevention
        </h3>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          Writing JSON directly to an existing target file via <code className="font-mono text-xs text-[#fffce1]">fs.writeFileSync(path, json)</code> creates a vulnerability. If the terminal process crashes, receives SIGKILL, or loses power mid-write, the target file is left half-written. The next startup will encounter invalid JSON syntax and crash.
        </p>

        <CodeBlock
          file="src/config/jsonFile.ts"
          language="typescript"
          highlightLines={[5, 6, 7, 8, 9, 10]}
          code={`export function writeJson(file: string, data: unknown, mode?: number): void {
  ensureDir(path.dirname(file));
  // 1. Write data to a unique temporary file in the same directory
  const tmp = \`\${file}.\${process.pid}.tmp\`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\\n", {
    encoding: "utf8",
    ...(mode === undefined ? {} : { mode }),
  });
  // 2. Atomically swap the temporary file into place
  fs.renameSync(tmp, file);
}`}
        />

        <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-5 text-xs">
          <div className="font-semibold text-[#fffce1]">The POSIX atomic rename guarantee</div>
          <p className="mt-1.5 leading-relaxed text-[#7c7c6f]">
            On POSIX filesystems, <code className="font-mono text-[#fffce1]">rename(2)</code> is an atomic syscall when the source and destination reside on the same filesystem. Any reader opening the file either sees the old valid version or the new complete version, never an intermediate truncated byte buffer.
          </p>
        </div>
      </div>

      {/* Credential Security */}
      <div className="space-y-4 pt-4 border-t border-[#42433d]">
        <div className="font-mono text-xs text-[#7c7c6f]">{'{ Owner Permissions }'}</div>
        <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          Credential security with POSIX 0600 mode
        </h3>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          Terminal agents store sensitive API keys for providers like OpenAI, OpenRouter, and DeepSeek. Storing these keys in world-readable files exposes them to other users on shared machines.
        </p>

        <CodeBlock
          file="src/config/auth.ts"
          language="typescript"
          code={`export function saveAuth(auth: AuthFile): void {
  // Mode 0o600: Read and write permissions for the file owner only.
  // Group and others have no read or write permissions.
  writeJson(authPath(), auth, 0o600);
}`}
        />
      </div>

      {/* Session Schema & Transcript Rehydration */}
      <div className="space-y-4 pt-4 border-t border-[#42433d]">
        <div className="font-mono text-xs text-[#7c7c6f]">{'{ Conversation Schema }'}</div>
        <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          Session schema and transcript rehydration
        </h3>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          Sessions persist at every turn boundary. When resuming a past conversation, PaperCode avoids replaying thousands of raw tool output lines into the terminal.
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#fffce1] font-mono">Session data schema</div>
            <CodeBlock
              file="src/sessions/store.ts"
              language="typescript"
              code={`export type Session = {
  id: string;          // YYYYMMDDHHMMSS-randomHex
  title: string;       // Auto-derived from first user turn
  cwd: string;         // Working directory where created
  createdAt: number;   // Epoch timestamp in milliseconds
  updatedAt: number;   // Updated at each turn boundary
  provider?: string;   // Active provider at save time
  model?: string;      // Active model at save time
  messages: ChatMessage[]; // Full message array seen by API
};`}
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#fffce1] font-mono">Tool run collapsing logic</div>
            <CodeBlock
              file="src/app.tsx"
              language="typescript"
              code={`// Rebuild the transcript from history. Tool traffic is collapsed to a
// count: replaying every result verbatim buries the conversation.
const rebuilt: Entry[] = [];
let toolRun = 0;
const flush = () => {
  if (toolRun > 0) {
    rebuilt.push({
      kind: "notice",
      text: \`  \${toolRun} tool call\${toolRun === 1 ? "" : "s"}\`,
      tone: "info",
    });
    toolRun = 0;
  }
};`}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
