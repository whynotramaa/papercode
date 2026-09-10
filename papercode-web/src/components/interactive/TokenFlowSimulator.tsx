import { useState, useEffect, useRef } from 'react'
import { Play, RotateCcw, AlertTriangle, CheckCircle2, ChevronRight, Ban } from 'lucide-react'
import { Badge } from '../Badge'

interface SSEChunk {
  index: number
  delta: {
    content?: string
    reasoning_content?: string
    tool_calls?: Array<{
      index: number
      id?: string
      function?: {
        name?: string
        arguments?: string
      }
    }>
  }
}

const CHUNKS: SSEChunk[] = [
  { index: 0, delta: { reasoning_content: 'The user wants to read src/utils.ts before editing.' } },
  { index: 1, delta: { reasoning_content: ' I will invoke the read tool first.' } },
  { index: 2, delta: { content: 'Let me ' } },
  { index: 3, delta: { content: 'inspect the file first.' } },
  {
    index: 4,
    delta: {
      tool_calls: [
        { index: 0, id: 'call_99a', function: { name: 'read', arguments: '' } },
        { index: 1, id: 'call_99b', function: { name: 'read', arguments: '' } },
      ],
    },
  },
  {
    index: 5,
    delta: {
      tool_calls: [
        { index: 0, function: { arguments: '{"path":' } },
        { index: 1, function: { arguments: '{"path":' } },
      ],
    },
  },
  {
    index: 6,
    delta: {
      tool_calls: [
        { index: 0, function: { arguments: '"src/utils.ts"}' } },
        { index: 1, function: { arguments: '"src/types.ts"}' } },
      ],
    },
  },
]

export function TokenFlowSimulator() {
  const [currentChunk, setCurrentChunk] = useState<number>(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [aborted, setAborted] = useState(false)
  const timerRef = useRef<number | null>(null)

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsPlaying(false)
  }

  const reset = () => {
    stopTimer()
    setCurrentChunk(-1)
    setAborted(false)
  }

  const stepForward = () => {
    if (currentChunk < CHUNKS.length - 1 && !aborted) {
      setCurrentChunk((c) => c + 1)
    } else {
      stopTimer()
    }
  }

  const handlePlay = () => {
    if (currentChunk >= CHUNKS.length - 1 || aborted) reset()
    setIsPlaying(true)
  }

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        setCurrentChunk((c) => {
          if (c >= CHUNKS.length - 1) {
            stopTimer()
            return c
          }
          return c + 1
        })
      }, 700)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying])

  const handleAbort = () => {
    stopTimer()
    setAborted(true)
  }

  let reasoningText = ''
  let responseText = ''
  const partialsMap: Record<number, { id: string; name: string; args: string }> = {}

  for (let i = 0; i <= currentChunk && i < CHUNKS.length; i++) {
    const chunk = CHUNKS[i]
    if (chunk.delta.reasoning_content) reasoningText += chunk.delta.reasoning_content
    if (chunk.delta.content) responseText += chunk.delta.content

    if (chunk.delta.tool_calls) {
      for (const tc of chunk.delta.tool_calls) {
        if (!partialsMap[tc.index]) {
          partialsMap[tc.index] = { id: '', name: '', args: '' }
        }
        if (tc.id) partialsMap[tc.index].id = tc.id
        if (tc.function?.name) partialsMap[tc.index].name += tc.function.name
        if (tc.function?.arguments) partialsMap[tc.index].args += tc.function.arguments
      }
    }
  }

  const parsedToolCalls = Object.entries(partialsMap).map(([index, p]) => ({
    index: Number(index),
    id: p.id || 'call_pending',
    name: p.name || 'pending...',
    args: p.args,
  }))

  const isComplete = currentChunk >= CHUNKS.length - 1

  return (
    <div className="my-8 rounded-[8px] border border-[#42433d] bg-[#191919] p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#42433d] pb-4">
        <div>
          <div className="font-mono text-sm text-[#abff84] mb-1">{'{ Wire Stream Parser }'}</div>
          <h3 className="text-xl font-semibold tracking-[-0.02em] text-[#fffce1]">
            SSE delta stream and partial tool assembly
          </h3>
          <p className="text-sm text-[#7c7c6f] mt-0.5">
            Watch Server-Sent Event fragments reassemble into reasoning, text, and structured tool arguments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isPlaying ? (
            <button
              onClick={handlePlay}
              disabled={isComplete}
              className="btn-pill-gradient text-xs py-2 px-4.5 disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{currentChunk === -1 ? 'Stream SSE' : 'Resume'}</span>
            </button>
          ) : (
            <button
              onClick={handleAbort}
              className="btn-pill-ghost text-xs py-2 px-4.5 border-[#ff8709] text-[#ff8709] hover:border-[#ff8709]/80"
            >
              <Ban className="h-3.5 w-3.5" />
              <span>Simulate Esc (Abort)</span>
            </button>
          )}

          <button
            onClick={stepForward}
            disabled={isPlaying || isComplete || aborted}
            className="btn-pill-ghost text-xs py-2 px-4 disabled:opacity-40"
          >
            <span>Step</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={reset}
            className="rounded-full border border-[#42433d] p-2 text-[#7c7c6f] hover:text-[#fffce1] hover:border-[#fffce1]/60"
            title="Reset"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Wire Stream Box */}
        <div className="space-y-4 lg:col-span-5">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-mono text-[#fffce1]">
                Raw Wire SSE Chunk
              </span>
              <span className="font-mono text-[#7c7c6f]">
                Chunk {currentChunk + 1} of {CHUNKS.length}
              </span>
            </div>

            <div className="h-48 overflow-y-auto rounded-[8px] border border-[#42433d] bg-[#0e100f] p-3 font-mono text-[11px] text-[#fffce1]">
              {currentChunk === -1 ? (
                <div className="flex h-full items-center justify-center text-[#7c7c6f]">
                  Click 'Stream SSE' or 'Step' to transmit deltas
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[#7c7c6f]">// data: chunk delta payload</div>
                  <pre key={currentChunk} className="text-[#abff84] whitespace-pre-wrap animate-linear-enter">
                    {JSON.stringify(CHUNKS[currentChunk].delta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Abort warning banner */}
          {aborted && (
            <div className="rounded-[8px] border border-[#ff8709]/60 bg-[#ff8709]/10 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#ff8709]">
                <AlertTriangle className="h-4 w-4" />
                <span>Turn interrupted mid-stream</span>
              </div>
              <p className="mt-1 text-xs text-[#fffce1]/90 leading-normal">
                PaperCode injects synthetic <code className="font-mono text-[11px] text-[#abff84]">abortedToolResult</code> responses for all pending calls. This keeps the OpenAI conversation history valid for the next request.
              </p>
            </div>
          )}
        </div>

        {/* Reassembled State Column */}
        <div className="space-y-4 rounded-[8px] border border-[#42433d] bg-[#0e100f] p-5 lg:col-span-7">
          <div className="font-mono text-xs text-[#7c7c6f] uppercase tracking-wider">
            Reassembled Agent State
          </div>

          {/* Reasoning block */}
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[#9d95ff] uppercase font-mono tracking-wide">
                1. Reasoning Tokens
              </span>
              <Badge variant="lilac" size="sm">
                reasoning_content
              </Badge>
            </div>
            <div className="rounded-[8px] border border-[#9d95ff]/30 bg-[#9d95ff]/10 p-3 text-xs text-[#fffce1] min-h-[2.5rem]">
              {reasoningText || <span className="text-[#7c7c6f] italic">No reasoning tokens yet</span>}
            </div>
          </div>

          {/* Assistant content */}
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[#fffce1] uppercase font-mono tracking-wide">
                2. Assistant Text
              </span>
              <Badge variant="default" size="sm">
                delta.content
              </Badge>
            </div>
            <div className="rounded-[8px] border border-[#42433d] bg-[#191919] p-3 text-xs text-[#fffce1] min-h-[2.5rem]">
              {responseText || <span className="text-[#7c7c6f] italic">No text content yet</span>}
            </div>
          </div>

          {/* Tool call slots */}
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[#0ae448] uppercase font-mono tracking-wide">
                3. Tool Call Slots (Accumulating by index)
              </span>
              <Badge variant="green" size="sm">
                partials.get(index)
              </Badge>
            </div>

            {parsedToolCalls.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-[#42433d] p-3 text-center text-xs text-[#7c7c6f]">
                No tool calls detected yet
              </div>
            ) : (
              <div className="space-y-2">
                {parsedToolCalls.map((tc) => (
                  <div
                    key={tc.index}
                    className="rounded-[8px] border border-[#0ae448]/40 bg-[#0ae448]/10 p-3 text-xs font-mono animate-linear-enter"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#abff84]">
                      <span>Slot [{tc.index}] &middot; ID: {tc.id}</span>
                      <span className="font-semibold text-[#fffce1]">Tool: {tc.name}</span>
                    </div>
                    <div className="mt-1.5 text-[#7c7c6f]">
                      Args: <span className="text-[#fffce1]">{tc.args || '""'}</span>
                    </div>

                    {aborted && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#ff8709]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Safety response: "Interrupted by the user before this tool finished."</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
