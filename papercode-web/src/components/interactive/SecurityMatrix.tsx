import { useState } from 'react'
import { Badge } from '../Badge'
import { Check, X, Terminal, Lock } from 'lucide-react'

type ToolName = 'read' | 'write' | 'edit' | 'bash' | 'ls' | 'glob' | 'grep'
type AgentMode = 'build' | 'plan'

const TOOLS_METADATA: Record<ToolName, { level: 'read-only' | 'mutating' | 'dangerous'; description: string }> = {
  read: { level: 'read-only', description: 'Read file contents with line numbering' },
  ls: { level: 'read-only', description: 'List directory entries' },
  glob: { level: 'read-only', description: 'Find files matching glob pattern' },
  grep: { level: 'read-only', description: 'Search files with regex matching' },
  edit: { level: 'mutating', description: 'Replace exact string in existing file' },
  write: { level: 'mutating', description: 'Create or overwrite whole file' },
  bash: { level: 'dangerous', description: 'Execute shell commands in cwd' },
}

const BASH_DENY_RULES = [
  { pattern: /rm\s+(-[a-z]*\s+)*-[a-z]*[rf][a-z]*\s+\/(?:\s|$)/i, why: 'recursive delete of /' },
  { pattern: /\bmkfs(\.|\s)/i, why: 'filesystem format' },
  { pattern: /\bdd\b[^|]*\bof=\/dev\/(sd|nvme|disk)/i, why: 'raw disk write' },
  { pattern: />\s*\/dev\/(sd|nvme|disk)/i, why: 'raw disk write' },
  { pattern: /:\(\)\s*\{\s*:\|:&\s*\}\s*;:/, why: 'fork bomb' },
]

export function SecurityMatrix() {
  const [selectedTool, setSelectedTool] = useState<ToolName>('write')
  const [selectedMode, setSelectedMode] = useState<AgentMode>('plan')
  const [targetPath, setTargetPath] = useState<string>('src/app.tsx')
  const [bashCommand, setBashCommand] = useState<string>('npm test')
  const [approvalChoice, setApprovalChoice] = useState<'granted' | 'denied'>('granted')

  const meta = TOOLS_METADATA[selectedTool]
  const isMutatingOrDangerous = meta.level !== 'read-only'

  // 1. Mode Gate Check
  let modeAllowed = true
  let modeReason = 'Tool permitted under current mode.'
  if (selectedMode === 'plan' && isMutatingOrDangerous) {
    modeAllowed = false
    modeReason =
      'Blocked: PaperCode is in PLAN mode, which is read-only. Do not try this tool or any other mutating tool again in this turn. Explain what you would change instead, and tell the user to press Tab to switch to BUILD mode if they want it applied.'
  }

  // 2. Path Confinement Check
  let pathAllowed = true
  let pathReason = 'Path stays within current working directory.'
  if (['read', 'write', 'edit'].includes(selectedTool)) {
    const escapes = targetPath.startsWith('..') || targetPath.startsWith('/')
    if (escapes) {
      pathAllowed = false
      pathReason = `Path escapes the working directory: ${targetPath}. PaperCode only operates inside /home/user/project.`
    }
  }

  // 3. Bash Safety Screen Check
  let bashAllowed = true
  let bashReason = 'Command passes safety filter.'
  if (selectedTool === 'bash') {
    for (const rule of BASH_DENY_RULES) {
      if (rule.pattern.test(bashCommand)) {
        bashAllowed = false
        bashReason = `Refused (${rule.why}). This command is blocked by PaperCode.`
        break
      }
    }
  }

  // 4. Approval Gate Check
  let approvalAllowed = true
  let approvalReason = 'Tool executed without interactive prompt.'
  if (isMutatingOrDangerous && modeAllowed && pathAllowed && bashAllowed) {
    if (approvalChoice === 'denied') {
      approvalAllowed = false
      approvalReason = `The user denied permission to run ${selectedTool}. Do not retry it. Ask what they would prefer, or continue with a different approach.`
    } else {
      approvalReason = 'User granted approval (once or session-persistent).'
    }
  }

  const finalAllowed = modeAllowed && pathAllowed && bashAllowed && approvalAllowed
  const finalError = !modeAllowed
    ? modeReason
    : !pathAllowed
    ? pathReason
    : !bashAllowed
    ? bashReason
    : !approvalAllowed
    ? approvalReason
    : null

  return (
    <div className="my-8 rounded-[8px] border border-[#42433d] bg-[#191919] p-6 text-[#fffce1]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#42433d] pb-4">
        <div>
          <div className="font-mono text-sm text-[#ff8709] mb-1">{'{ Sandbox Enforcement Engine }'}</div>
          <h3 className="text-xl font-semibold tracking-[-0.02em] text-[#fffce1]">
            Security sandbox & permission gate simulator
          </h3>
          <p className="text-sm text-[#7c7c6f] mt-0.5">
            Test how PaperCode handles plan mode locks, path traversal attacks, blacklisted commands, and user approval gates.
          </p>
        </div>
        <Badge variant={finalAllowed ? 'green' : 'orange'}>
          {finalAllowed ? 'Execution Permitted' : 'Execution Refused'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Controls Column */}
        <div className="space-y-4 lg:col-span-5">
          {/* Tool Selector */}
          <div>
            <label className="mb-2 block font-mono text-xs text-[#7c7c6f] uppercase tracking-wider">
              Select Tool to Execute
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(TOOLS_METADATA) as ToolName[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTool(t)}
                  className={`rounded-[100px] border px-2.5 py-1.5 text-xs font-mono transition-colors ${
                    selectedTool === t
                      ? 'border-[#fffce1] bg-[#0e100f] text-[#fffce1] font-semibold'
                      : 'border-[#42433d] bg-transparent text-[#7c7c6f] hover:border-[#7c7c6f] hover:text-[#fffce1]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-[#7c7c6f]">Classification:</span>
              <Badge
                variant={
                  meta.level === 'read-only'
                    ? 'green'
                    : meta.level === 'mutating'
                    ? 'orange'
                    : 'pink'
                }
              >
                {meta.level}
              </Badge>
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="mb-2 block font-mono text-xs text-[#7c7c6f] uppercase tracking-wider">
              Active Agent Mode (Tab toggle)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedMode('plan')}
                className={`flex items-center justify-center gap-2 rounded-[100px] border p-2 text-xs font-mono ${
                  selectedMode === 'plan'
                    ? 'border-[#ff8709] bg-[#ff8709]/10 text-[#ff8709] font-semibold'
                    : 'border-[#42433d] bg-transparent text-[#7c7c6f] hover:text-[#fffce1]'
                }`}
              >
                <Lock className="h-3.5 w-3.5 text-[#ff8709]" />
                <span>PLAN (Read-only)</span>
              </button>
              <button
                onClick={() => setSelectedMode('build')}
                className={`flex items-center justify-center gap-2 rounded-[100px] border p-2 text-xs font-mono ${
                  selectedMode === 'build'
                    ? 'border-[#abff84] bg-[#0ae448]/10 text-[#abff84] font-semibold'
                    : 'border-[#42433d] bg-transparent text-[#7c7c6f] hover:text-[#fffce1]'
                }`}
              >
                <Terminal className="h-3.5 w-3.5 text-[#abff84]" />
                <span>BUILD (Mutating)</span>
              </button>
            </div>
          </div>

          {/* Path Parameter Input */}
          {['read', 'write', 'edit'].includes(selectedTool) && (
            <div>
              <label className="mb-2 block font-mono text-xs text-[#7c7c6f] uppercase tracking-wider">
                Target File Path Argument
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={targetPath}
                  onChange={(e) => setTargetPath(e.target.value)}
                  className="w-full rounded-[8px] border border-[#42433d] bg-[#0e100f] px-3 py-1.5 font-mono text-xs text-[#fffce1]"
                />
              </div>
              <div className="mt-1.5 flex gap-2 font-mono">
                <button
                  onClick={() => setTargetPath('src/app.tsx')}
                  className="text-[10px] text-[#abff84] hover:underline"
                >
                  src/app.tsx (Safe)
                </button>
                <span className="text-[10px] text-[#42433d]">&middot;</span>
                <button
                  onClick={() => setTargetPath('../../../../etc/passwd')}
                  className="text-[10px] text-[#ff8709] hover:underline"
                >
                  ../../../../etc/passwd (Escape)
                </button>
              </div>
            </div>
          )}

          {/* Bash Command Input */}
          {selectedTool === 'bash' && (
            <div>
              <label className="mb-2 block font-mono text-xs text-[#7c7c6f] uppercase tracking-wider">
                Command Argument
              </label>
              <input
                type="text"
                value={bashCommand}
                onChange={(e) => setBashCommand(e.target.value)}
                className="w-full rounded-[8px] border border-[#42433d] bg-[#0e100f] px-3 py-1.5 font-mono text-xs text-[#fffce1]"
              />
              <div className="mt-1.5 flex flex-wrap gap-2 font-mono">
                <button
                  onClick={() => setBashCommand('npm test')}
                  className="text-[10px] text-[#abff84] hover:underline"
                >
                  npm test (Safe)
                </button>
                <span className="text-[10px] text-[#42433d]">&middot;</span>
                <button
                  onClick={() => setBashCommand('rm -rf /')}
                  className="text-[10px] text-[#ff8709] hover:underline"
                >
                  rm -rf / (Blacklisted)
                </button>
                <span className="text-[10px] text-[#42433d]">&middot;</span>
                <button
                  onClick={() => setBashCommand(':(){ :|:& };:')}
                  className="text-[10px] text-[#ff8709] hover:underline"
                >
                  fork bomb (Blacklisted)
                </button>
              </div>
            </div>
          )}

          {/* Interactive User Approval Simulation */}
          {isMutatingOrDangerous && (
            <div>
              <label className="mb-2 block font-mono text-xs text-[#7c7c6f] uppercase tracking-wider">
                User Interactive Approval Simulation
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setApprovalChoice('granted')}
                  className={`flex-1 rounded-[100px] border p-2 text-xs font-mono ${
                    approvalChoice === 'granted'
                      ? 'border-[#abff84] bg-[#0ae448]/10 text-[#abff84]'
                      : 'border-[#42433d] bg-transparent text-[#7c7c6f]'
                  }`}
                >
                  User Approves
                </button>
                <button
                  onClick={() => setApprovalChoice('denied')}
                  className={`flex-1 rounded-[100px] border p-2 text-xs font-mono ${
                    approvalChoice === 'denied'
                      ? 'border-[#ff8709] bg-[#ff8709]/10 text-[#ff8709]'
                      : 'border-[#42433d] bg-transparent text-[#7c7c6f]'
                  }`}
                >
                  User Denies (Esc / 3)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Evaluation Output Column */}
        <div className="space-y-4 rounded-[8px] border border-[#42433d] bg-[#0e100f] p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[#42433d] pb-3">
            <span className="font-mono text-xs text-[#7c7c6f] uppercase tracking-wider">
              Security Inspection Pipeline
            </span>
            <span className="font-mono text-[11px] text-[#7c7c6f]">4 Verification Gates</span>
          </div>

          {/* Barrier 1: Mode Check */}
          <div className="flex items-start gap-3 rounded-[8px] border border-[#42433d] bg-[#191919] p-3 text-xs">
            <div className={`mt-0.5 rounded-full p-0.5 ${modeAllowed ? 'text-[#abff84]' : 'text-[#ff8709]'}`}>
              {modeAllowed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between font-medium text-[#fffce1]">
                <span>1. Mode Gate Check (checkMode)</span>
                <span className={modeAllowed ? 'text-[#abff84] text-[11px]' : 'text-[#ff8709] text-[11px]'}>
                  {modeAllowed ? 'Pass' : 'Failed'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#7c7c6f] leading-relaxed">
                {modeReason}
              </p>
            </div>
          </div>

          {/* Barrier 2: Path Confinement */}
          {['read', 'write', 'edit'].includes(selectedTool) && (
            <div className="flex items-start gap-3 rounded-[8px] border border-[#42433d] bg-[#191919] p-3 text-xs">
              <div className={`mt-0.5 rounded-full p-0.5 ${pathAllowed ? 'text-[#abff84]' : 'text-[#ff8709]'}`}>
                {pathAllowed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between font-medium text-[#fffce1]">
                  <span>2. Sandbox Path Confinement (resolveInRoot)</span>
                  <span className={pathAllowed ? 'text-[#abff84] text-[11px]' : 'text-[#ff8709] text-[11px]'}>
                    {pathAllowed ? 'Pass' : 'Failed'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#7c7c6f] leading-relaxed">
                  {pathReason}
                </p>
              </div>
            </div>
          )}

          {/* Barrier 3: Bash Screening */}
          {selectedTool === 'bash' && (
            <div className="flex items-start gap-3 rounded-[8px] border border-[#42433d] bg-[#191919] p-3 text-xs">
              <div className={`mt-0.5 rounded-full p-0.5 ${bashAllowed ? 'text-[#abff84]' : 'text-[#ff8709]'}`}>
                {bashAllowed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between font-medium text-[#fffce1]">
                  <span>3. Dangerous Command Screening (screenBashCommand)</span>
                  <span className={bashAllowed ? 'text-[#abff84] text-[11px]' : 'text-[#ff8709] text-[11px]'}>
                    {bashAllowed ? 'Pass' : 'Failed'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#7c7c6f] leading-relaxed">
                  {bashReason}
                </p>
              </div>
            </div>
          )}

          {/* Barrier 4: Approval Gate */}
          {isMutatingOrDangerous && (
            <div className="flex items-start gap-3 rounded-[8px] border border-[#42433d] bg-[#191919] p-3 text-xs">
              <div className={`mt-0.5 rounded-full p-0.5 ${approvalAllowed ? 'text-[#abff84]' : 'text-[#ff8709]'}`}>
                {approvalAllowed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between font-medium text-[#fffce1]">
                  <span>4. User Approval Prompt (requestApproval)</span>
                  <span className={approvalAllowed ? 'text-[#abff84] text-[11px]' : 'text-[#ff8709] text-[11px]'}>
                    {approvalAllowed ? 'Pass' : 'Failed'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#7c7c6f] leading-relaxed">
                  {approvalReason}
                </p>
              </div>
            </div>
          )}

          {/* Result Payload Box */}
          <div className="mt-4 rounded-[8px] border border-[#42433d] bg-[#191919] p-3.5 font-mono text-[11px]">
            <div className="text-[#7c7c6f] mb-1">// ToolResult returned to agent turn loop</div>
            {finalAllowed ? (
              <div className="text-[#abff84]">
                {`{ content: "Execution completed successfully.", isError: false }`}
              </div>
            ) : (
              <div className="text-[#ff8709]">
                {`{ content: "${finalError}", isError: true }`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
