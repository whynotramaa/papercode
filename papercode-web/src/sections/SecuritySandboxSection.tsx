import { Badge } from '../components/Badge'
import { CodeBlock } from '../components/CodeBlock'
import { SecurityMatrix } from '../components/interactive/SecurityMatrix'
import { Lock, FolderLock, Terminal } from 'lucide-react'

export function SecuritySandboxSection() {
  return (
    <section id="security-sandbox" className="space-y-12 pt-6 border-t border-[#42433d]">
      {/* Header */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="curly-annotation text-sm text-[#ff8709] font-mono">
            {'{ Security Sandbox }'}
          </span>
          <span className="text-[#42433d]">&middot;</span>
          <span className="text-xs font-mono text-[#7c7c6f]">Dual-layer Gating &middot; Path Confinement &middot; Bash Screening</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          The security sandbox and permission engine
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[#fffce1]/80 max-w-3xl">
          Autonomous coding agents that execute arbitrary shell commands and edit local files require strict security boundaries. PaperCode enforces a defense-in-depth model that combines prompt-level tool filtering, runtime permission checks, path confinement, and dangerous command screening.
        </p>
      </div>

      {/* Dual Layer Plan Mode */}
      <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#42433d] pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-[#ff8709]/40 bg-[#ff8709]/10 p-2 text-[#ff8709]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#fffce1]">
                Dual-layer PLAN mode defense
              </h3>
              <p className="text-xs text-[#7c7c6f]">
                Why prompt withholding alone does not provide a security boundary
              </p>
            </div>
          </div>
          <Badge variant="orange">Tab to toggle</Badge>
        </div>

        <p className="text-xs leading-relaxed text-[#fffce1]/90">
          Pressing Tab toggles between BUILD mode and PLAN mode. In PLAN mode, PaperCode guarantees that no files will be modified and no shell commands will execute. This guarantee is enforced at two separate layers.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-5 space-y-2">
            <div className="font-semibold text-[#ff8709] font-mono">Layer 1: Prompt filtering</div>
            <p className="text-[#7c7c6f] leading-relaxed">
              When building completion requests, <code className="font-mono text-[11px] text-[#fffce1]">toolDefinitions(mode)</code> strips write, edit, and bash from the tools schema sent to the API. The system prompt also explicitly instructs the model that mutating tools are unavailable.
            </p>
          </div>

          <div className="rounded-[8px] border border-[#42433d] bg-[#0e100f] p-5 space-y-2">
            <div className="font-semibold text-[#abff84] font-mono">Layer 2: Runtime gate</div>
            <p className="text-[#7c7c6f] leading-relaxed">
              Language models can hallucinate tool calls that were never declared in the schema. Inside <code className="font-mono text-[11px] text-[#fffce1]">executeTool()</code>, PaperCode validates <code className="font-mono text-[11px] text-[#fffce1]">checkMode(tool.permission, mode)</code> before executing any function. If mode is "plan" and the tool is mutating, execution is immediately refused.
            </p>
          </div>
        </div>

        <CodeBlock
          file="src/tools/permissions.ts"
          language="typescript"
          code={`const PLAN_BLOCKED =
  "Blocked: PaperCode is in PLAN mode, which is read-only. Do not try this tool or any other " +
  "mutating tool again in this turn. Explain what you would change instead, and tell the user to " +
  "press Tab to switch to BUILD mode if they want it applied.";

export function checkMode(level: PermissionLevel, mode: Mode): Decision {
  if (mode === "plan" && level !== "read-only") {
    return { allow: false, reason: PLAN_BLOCKED };
  }
  return { allow: true };
}`}
        />
      </div>

      {/* Path Confinement Sandbox */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FolderLock className="h-5 w-5 text-[#00bae2]" />
          <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
            Filesystem confinement sandbox
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          A coding agent must operate strictly inside the repository or folder where it was launched. Path arguments like <code className="font-mono text-xs text-[#ff8709]">../../../../etc/passwd</code> or absolute paths like <code className="font-mono text-xs text-[#ff8709]">/var/log/syslog</code> must be rejected before any filesystem read or write syscall.
        </p>

        <CodeBlock
          file="src/tools/permissions.ts"
          language="typescript"
          highlightLines={[2, 3, 5, 6, 7]}
          code={`export function resolveInRoot(root: string, input: string): { ok: true; path: string } | { ok: false; reason: string } {
  const resolved = path.resolve(root, input);
  const rel = path.relative(root, resolved);

  const escapes = rel.startsWith("..") || path.isAbsolute(rel);
  if (escapes) {
    return {
      ok: false,
      reason: \`Path escapes the working directory: \${input}. PaperCode only operates inside \${root}.\`,
    };
  }
  return { ok: true, path: resolved };
}`}
        />

        <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-5 text-xs">
          <div className="font-semibold text-[#fffce1]">How resolveInRoot works</div>
          <p className="mt-1.5 leading-relaxed text-[#7c7c6f]">
            The function normalizes target paths using <code className="font-mono text-[#fffce1]">path.resolve</code>, then calculates the relative path from the project root. If the relative path starts with <code className="font-mono text-[#fffce1]">..</code> or remains an absolute path, it means the target resolved outside the workspace boundary. The function returns an error explaining the confinement rule to the model.
          </p>
        </div>
      </div>

      {/* Bash Screening & Denial Rules */}
      <div className="space-y-4 pt-4 border-t border-[#42433d]">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-[#ff8709]" />
          <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[#fffce1]">
            Blacklist screening for dangerous shell commands
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-[#7c7c6f] max-w-3xl">
          Even in BUILD mode with user approval enabled, certain catastrophic shell commands are screened and refused before prompting the user.
        </p>

        <CodeBlock
          file="src/tools/permissions.ts"
          language="typescript"
          code={`const BASH_DENY: { pattern: RegExp; why: string }[] = [
  { pattern: /rm\\s+(-[a-z]*\\s+)*-[a-z]*[rf][a-z]*\\s+\\/(?:\\s|$)/i, why: "recursive delete of /" },
  { pattern: /\\bmkfs(\\.|\\s)/i, why: "filesystem format" },
  { pattern: /\\bdd\\b[^|]*\\bof=\\/dev\\/(sd|nvme|disk)/i, why: "raw disk write" },
  { pattern: />\\s*\\/dev\\/(sd|nvme|disk)/i, why: "raw disk write" },
  { pattern: /:\\(\\)\\s*\\{\\s*:\\|:&\\s*\\}\\s*;:/, why: "fork bomb" },
];`}
        />
      </div>

      {/* Interactive Security Matrix */}
      <SecurityMatrix />
    </section>
  )
}
