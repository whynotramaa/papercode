import { useState } from 'react'
import { Badge } from '../Badge'
import { AlertCircle, CheckCircle, ArrowDown, Scissors, RefreshCw } from 'lucide-react'

interface MessageItem {
  id: number
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  hasToolCalls?: boolean
  toolCallId?: string
  tokens: number
}

const CONVERSATION: MessageItem[] = [
  { id: 0, role: 'system', content: 'You are PaperCode...', tokens: 280 },
  { id: 1, role: 'user', content: 'Add error handling to routes/auth.ts', tokens: 18 },
  { id: 2, role: 'assistant', content: '', hasToolCalls: true, tokens: 42 },
  { id: 3, role: 'tool', content: 'export function handleLogin() { ... }', toolCallId: 'call_1', tokens: 450 },
  { id: 4, role: 'assistant', content: '', hasToolCalls: true, tokens: 58 },
  { id: 5, role: 'tool', content: 'DATABASE_URL=postgres://...', toolCallId: 'call_2a', tokens: 120 },
  { id: 6, role: 'tool', content: 'FOUND 3 matches in config.ts', toolCallId: 'call_2b', tokens: 95 },
  { id: 7, role: 'assistant', content: 'I have inspected both files. Let me apply the patch.', tokens: 35 },
  { id: 8, role: 'user', content: 'Also wrap the database query in a try/catch', tokens: 24 },
  { id: 9, role: 'assistant', content: 'Patch applied successfully.', tokens: 16 },
]

export function CompactionVisualizer() {
  const [preferredIndex, setPreferredIndex] = useState<number>(5)

  const calculateSafeSplit = (preferred: number): { safeIndex: number; stepsTaken: number; reason: string } => {
    let i = Math.max(0, Math.min(preferred, CONVERSATION.length))
    let steps = 0

    while (i > 0) {
      const here = CONVERSATION[i]
      const before = CONVERSATION[i - 1]
      const landsOnOrphan = here !== undefined && here.role === 'tool'
      const splitsACall = before !== undefined && Boolean(before.hasToolCalls)

      if (!landsOnOrphan && !splitsACall) break
      i--
      steps++
    }

    let reason = 'Safe boundary: No tool transactions are bisected.'
    if (steps > 0) {
      reason = `Stepped back ${steps} message positions to prevent severing tool call requests from their response results.`
    }

    return { safeIndex: i, stepsTaken: steps, reason }
  }

  const { safeIndex, stepsTaken, reason } = calculateSafeSplit(preferredIndex)

  const toSummarize = CONVERSATION.slice(1, safeIndex)
  const keptRecent = CONVERSATION.slice(safeIndex)

  const tokensBefore = CONVERSATION.reduce((acc, m) => acc + m.tokens, 0)
  const tokensSummarized = toSummarize.reduce((acc, m) => acc + m.tokens, 0)
  const tokensAfter = tokensBefore - tokensSummarized + 180

  return (
    <div className="my-8 rounded-[8px] border border-[#42433d] bg-[#191919] p-6 text-[#fffce1]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#42433d] pb-4">
        <div>
          <div className="font-mono text-sm text-[#fec5fb] mb-1">{'{ Context Compaction }'}</div>
          <h3 className="text-xl font-semibold tracking-[-0.02em] text-[#fffce1]">
            Safe split boundary algorithm
          </h3>
          <p className="text-sm text-[#7c7c6f] mt-0.5">
            Adjust the slider to observe how PaperCode prevents orphaned tool messages by retreating to clean turn boundaries.
          </p>
        </div>

        <div className="text-right">
          <span className="font-mono text-xs text-[#7c7c6f]">Token Recovery</span>
          <div className="font-mono text-sm font-semibold text-[#abff84]">
            {tokensBefore} &rarr; {tokensAfter} ({Math.round(((tokensBefore - tokensAfter) / tokensBefore) * 100)}% saved)
          </div>
        </div>
      </div>

      {/* Slider Control */}
      <div className="mb-6 rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-[#fffce1]">
            <Scissors className="h-4 w-4 text-[#fec5fb]" />
            <span>Target split slider (Index: {preferredIndex})</span>
          </div>
          <div className="flex gap-2">
            <Badge variant="neutral">Preferred: #{preferredIndex}</Badge>
            <Badge variant={stepsTaken > 0 ? 'orange' : 'green'}>
              Resolved safe: #{safeIndex}
            </Badge>
          </div>
        </div>

        <input
          type="range"
          min={1}
          max={CONVERSATION.length - 1}
          value={preferredIndex}
          onChange={(e) => setPreferredIndex(Number(e.target.value))}
          className="mt-3 w-full cursor-pointer"
        />

        <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-[#7c7c6f]">
          <span>Older messages (Index 1)</span>
          <span>Recent messages (Index {CONVERSATION.length - 1})</span>
        </div>
      </div>

      {/* Warning or Success Resolution Banner */}
      <div
        className={`mb-6 rounded-[8px] border p-3.5 text-xs ${
          stepsTaken > 0
            ? 'border-[#ff8709]/50 bg-[#ff8709]/10 text-[#ff8709]'
            : 'border-[#0ae448]/40 bg-[#0ae448]/10 text-[#abff84]'
        }`}
      >
        <div className="flex items-center gap-2 font-semibold">
          {stepsTaken > 0 ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
          <span>{stepsTaken > 0 ? 'Boundary violation defended' : 'Clean split position'}</span>
        </div>
        <p className="mt-1 text-[#fffce1]/90 leading-relaxed font-sans">{reason}</p>
      </div>

      {/* Message Sequence Timeline */}
      <div className="space-y-2 font-mono text-xs">
        {CONVERSATION.map((msg) => {
          const isSystem = msg.role === 'system'
          const isSummarized = !isSystem && msg.id < safeIndex
          const isBoundary = msg.id === safeIndex

          return (
            <div key={msg.id}>
              {isBoundary && (
                <div className="my-2.5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#00bae2]/50" />
                  <div className="flex items-center gap-1.5 rounded-full border border-[#00bae2]/60 bg-[#00bae2]/15 px-3 py-0.5 text-[10px] font-semibold text-[#00bae2] uppercase tracking-wider">
                    <ArrowDown className="h-3 w-3" />
                    <span>Safe split boundary (Index {safeIndex})</span>
                  </div>
                  <div className="h-px flex-1 bg-[#00bae2]/50" />
                </div>
              )}

              <div
                className={`flex items-center justify-between rounded-[8px] border px-3.5 py-2.5 transition-all ${
                  isSystem
                    ? 'border-[#42433d] bg-[#141414] text-[#7c7c6f]'
                    : isSummarized
                    ? 'border-[#ff8709]/30 bg-[#ff8709]/10 text-[#fffce1]'
                    : 'border-[#0ae448]/30 bg-[#0ae448]/10 text-[#fffce1]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-[11px] text-[#7c7c6f]">#{msg.id}</span>
                  <span
                    className={`rounded-[4px] px-1.5 py-0.5 text-[10px] uppercase font-semibold ${
                      msg.role === 'user'
                        ? 'text-[#00bae2] border border-[#00bae2]/40 bg-[#00bae2]/10'
                        : msg.role === 'assistant'
                        ? 'text-[#9d95ff] border border-[#9d95ff]/40 bg-[#9d95ff]/10'
                        : msg.role === 'tool'
                        ? 'text-[#ff8709] border border-[#ff8709]/40 bg-[#ff8709]/10'
                        : 'text-[#7c7c6f] border border-[#42433d] bg-[#191919]'
                    }`}
                  >
                    {msg.role}
                  </span>
                  <span className="text-xs truncate max-w-xs md:max-w-md text-[#fffce1]">
                    {msg.hasToolCalls
                      ? 'tool_calls: [read, grep]'
                      : msg.toolCallId
                      ? `tool_result for ${msg.toolCallId}`
                      : msg.content}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-[#7c7c6f]">~{msg.tokens} tokens</span>
                  <span
                    className={`rounded-[4px] px-1.5 py-0.5 text-[10px] uppercase ${
                      isSystem
                        ? 'text-[#7c7c6f]'
                        : isSummarized
                        ? 'text-[#ff8709] border border-[#ff8709]/40'
                        : 'text-[#abff84] border border-[#0ae448]/40 font-semibold'
                    }`}
                  >
                    {isSystem ? 'Preserved' : isSummarized ? 'Summarized' : 'Retained'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary Output Box */}
      <div className="mt-6 rounded-[8px] border border-[#42433d] bg-[#0e100f] p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-semibold text-[#fffce1]">
            <RefreshCw className="h-3.5 w-3.5 text-[#abff84]" />
            <span>Reconstructed Prompt Structure</span>
          </div>
          <Badge variant="green">Receipt</Badge>
        </div>
        <div className="space-y-1.5 font-mono text-[11px] text-[#7c7c6f]">
          <div>1. System message (preserved intact)</div>
          <div className="text-[#9d95ff]">
            2. User message: "[Earlier conversation, summarized] \n User asked to add error handling... Read routes/auth.ts..."
          </div>
          <div className="text-[#00bae2]">
            3. Assistant confirmation: "Understood, I have the earlier context."
          </div>
          <div className="text-[#abff84]">
            4..{4 + keptRecent.length - 1}. Retained recent messages ({keptRecent.length} items untouched)
          </div>
        </div>
      </div>
    </div>
  )
}
