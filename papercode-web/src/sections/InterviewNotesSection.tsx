import { useState } from 'react'
import { Badge } from '../components/Badge'
import { CodeBlock } from '../components/CodeBlock'
import { ChevronDown, BookOpen, Search } from 'lucide-react'

interface InterviewItem {
  id: string
  category: 'Terminal & CLI' | 'Token Streaming' | 'Compaction' | 'Security' | 'State & Persistence'
  question: string
  summary: string
  detailedAnswer: string
  sourceFiles: string[]
  code?: {
    file: string
    snippet: string
  }
}

const QUESTIONS: InterviewItem[] = [
  {
    id: 'q1',
    category: 'Terminal & CLI',
    question: 'Why use React and Ink in a terminal rather than an imperative curses library like blessed?',
    summary: 'Ink turns terminal output into a declarative state machine, avoiding manual cursor coordinates while integrating with React hooks and unit test harnesses.',
    detailedAnswer:
      'Imperative terminal libraries like blessed or curses require developers to calculate column and row coordinates by hand, manage absolute screen buffers, and manually erase dirty rectangles. Ink integrates Facebook Yoga, compiling standard flexbox box models into terminal cells. This lets engineers structure UI using declarative state machines, React hooks (useState, useEffect, useInput), and component composition. Furthermore, ink-testing-library allows running headless end-to-end tests that assert on rendered text grids and simulate stdin keystrokes without launching real terminal windows.',
    sourceFiles: ['src/app.tsx', 'src/ui/components/Editor.tsx'],
  },
  {
    id: 'q2',
    category: 'Terminal & CLI',
    question: 'How does the duplicate frame bug happen in terminal emulators, and how does PaperCode prevent it?',
    summary: 'Frames taller than the physical terminal force the buffer to scroll. ANSI cursor-up codes cannot reach rows in the scrollback history, causing duplicate frames to accumulate.',
    detailedAnswer:
      'When an Ink component repaints, it calculates its frame height N and writes ANSI escape \\x1b[NA, which tells the terminal emulator to move the cursor up by N rows and overwrite the existing frame. If N exceeds the physical terminal height (for example, 28 rows in a standard 24-row terminal), the bottom rows force the terminal to scroll downward. The top rows scroll out of the visible screen into the history buffer. Terminal emulators strictly forbid cursor movements past row zero into the scrollback buffer. As a result, the cursor stops at row zero, leaving the stranded old frame above and drawing the new frame below. PaperCode solves this by hard-capping interactive panels to MAX_ROWS = 20, windowing lists with useViewport() and listCapacity(), and mounting finished output in <Static>.',
    sourceFiles: ['src/ui/ui.test.tsx', 'src/ui/useViewport.ts'],
    code: {
      file: 'src/ui/ui.test.tsx',
      snippet: `// Ink erases a frame by moving the cursor up by its height. A frame taller
// than the terminal cannot be erased, so the next one draws below the
// remains — which looks like the panel duplicating on every keypress. Any
// always-visible panel has to stay well inside a standard 24-row terminal.
const MAX_ROWS = 20;

function heightOf(frame: string | undefined): number {
  return (frame ?? "").split("\\n").length;
}

it("keeps the provider list short enough for Ink to erase", async () => {
  const app = wrap(<Connect onDone={() => {}} onCancel={() => {}} />);
  await tick();
  expect(heightOf(app.lastFrame())).toBeLessThanOrEqual(MAX_ROWS);
});`,
    },
  },
  {
    id: 'q3',
    category: 'Terminal & CLI',
    question: 'Explain the Kitty keyboard protocol and why classic TTY drivers cannot handle Shift+Enter.',
    summary: 'Classic TTY drivers send byte 0x0D for Enter regardless of modifier keys. The Kitty protocol enables distinct byte events for Shift+Enter, with Ctrl+J as fallback.',
    detailedAnswer:
      'In traditional VT100 and ANSI terminal emulators, pressing Enter transmits ASCII carriage return (0x0D, \\r). The legacy TTY line discipline discards the state of the Shift modifier key when Enter is pressed, transmitting the exact same byte sequence. To support multiline editor inputs, modern terminals implement the Kitty progressive keyboard protocol. PaperCode detects Kitty, Ghostty, and WezTerm, then pushes escape code \\x1b[>1u to enable alternate key reporting. If the host terminal lacks support, PaperCode transparently falls back to Ctrl+J (ASCII line feed 0x0A), which remains distinct from Enter in raw terminal mode. Finally, signal listeners ensure \\x1b[<u is transmitted on exit to avoid corrupting the user shell.',
    sourceFiles: ['src/ui/keyboard.ts', 'src/cli.tsx'],
  },
  {
    id: 'q4',
    category: 'Token Streaming',
    question: 'What is the Dangling Tool Call Trap, and how does PaperCode defend message history invariants?',
    summary: 'The OpenAI API requires every tool_call ID to have a matching tool response. On mid-stream aborts, PaperCode synthesizes aborted tool results to keep history valid.',
    detailedAnswer:
      'Under the OpenAI Chat Completion protocol, if an assistant message carries a tool_calls array, the conversation history must immediately follow with tool response messages matching each ID. If a user presses Escape while parallel tool calls are pending, a naive agent loop that simply stops would leave the assistant message in history with unanswered tool call IDs. The subsequent user turn will fail with an HTTP 400 error. PaperCode iterates through all pending calls on abort, pushing synthetic abortedToolResult messages with text "Interrupted by the user before this tool finished." This satisfies the API contract and allows conversation to continue seamlessly.',
    sourceFiles: ['src/agent/loop.ts', 'src/agent/messages.ts'],
    code: {
      file: 'src/agent/loop.ts',
      snippet: `for (const [i, call] of calls.entries()) {
  if (signal.aborted) {
    // Every remaining call still needs a result message or the next request
    // is rejected for an unanswered tool_call id.
    for (const pending of calls.slice(i)) messages.push(abortedToolResult(pending.id));
    onEvent({ type: "turn_end", reason: "aborted" });
    return { reason: "aborted" };
  }
  // Run tool...
}`,
    },
  },
  {
    id: 'q5',
    category: 'State & Persistence',
    question: 'Why does PaperCode write session files atomically via temporary file rename rather than direct write?',
    summary: 'Writing directly to files risks corrupted JSON if interrupted. Atomic rename ensures readers only ever observe complete, valid states.',
    detailedAnswer:
      'Standard file write operations with fs.writeFileSync write data in chunks. If the application process crashes, is terminated by SIGKILL, or experiences sudden power loss mid-write, the target file is left with incomplete, truncated JSON bytes. On subsequent launches, JSON.parse fails and the entire session is corrupted. PaperCode writes payload data to a process-unique temporary file (path.pid.tmp), then executes fs.renameSync. On POSIX filesystems, rename(2) is an atomic filesystem operation. Any reader opening the file either sees the old version or the fully flushed new version, guaranteeing complete data integrity.',
    sourceFiles: ['src/config/jsonFile.ts', 'src/sessions/store.ts'],
  },
  {
    id: 'q6',
    category: 'Compaction',
    question: 'How does the safeSplitIndex algorithm prevent invalid API state during context compaction?',
    summary: 'It checks whether a split point lands on an orphan tool result or bisects an assistant tool_calls message, stepping backward until reaching a clean message boundary.',
    detailedAnswer:
      'When context limits are reached, the agent compacts older history by summarizing earlier messages and keeping recent ones. If a split algorithm naively slices the array at a fixed index, it can sever an assistant message that requested tool calls from the tool messages that answered them. Splitting between them produces two invalid states: the summarized section ends with unanswered tool calls, and the retained section begins with orphaned tool results. The safeSplitIndex function checks two invariants at the split point: isToolResult(here) and hasToolCalls(before). If either condition is true, it steps backward in a while loop until both are false.',
    sourceFiles: ['src/agent/compact.ts'],
    code: {
      file: 'src/agent/compact.ts',
      snippet: `export function safeSplitIndex(messages: ChatMessage[], preferred: number): number {
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
}`,
    },
  },
  {
    id: 'q7',
    category: 'Security',
    question: 'Why is PLAN mode gating enforced at runtime rather than relying solely on prompt withholding?',
    summary: 'Language models hallucinate tools that were omitted from their schema. The runtime checkMode function inside executeTool provides an absolute guarantee.',
    detailedAnswer:
      'Withholding mutating tools like write, edit, and bash from the OpenAI tool definitions payload in PLAN mode reduces the likelihood of the model attempting to modify code. However, models trained on tool-calling datasets frequently hallucinate tool calls based on context or user prompts. If an agent relies entirely on prompt filtering, a hallucinated tool call would execute unchecked. PaperCode treats tool definition withholding as a prompt optimization, while executeTool validates checkMode(tool.permission, mode) as the authoritative security barrier. If mode is plan and permission is mutating or dangerous, the call is blocked immediately.',
    sourceFiles: ['src/tools/index.ts', 'src/tools/permissions.ts'],
  },
  {
    id: 'q8',
    category: 'Security',
    question: 'How does resolveInRoot prevent directory traversal attacks without breaking project relative paths?',
    summary: 'It resolves the absolute path and computes relative distance to root, rejecting any path that starts with .. or remains absolute.',
    detailedAnswer:
      'When a model or user provides a path argument, resolveInRoot runs path.resolve(root, input) to calculate a normalized absolute path. It then runs path.relative(root, resolved). If the relative path begins with .. or path.isAbsolute(rel) evaluates to true, the path attempts to break out of the workspace directory (for example, ../../../../etc/passwd). If this check passes, the tool receives a safe, canonical path confined strictly within the project tree.',
    sourceFiles: ['src/tools/permissions.ts'],
  },
  {
    id: 'q9',
    category: 'Token Streaming',
    question: 'Why does PaperCode configure maxRetries: 0 on the OpenAI client?',
    summary: 'SDK retries occur silently in the background, appearing to terminal users as a frozen process. Disabling retries surfaces errors immediately.',
    detailedAnswer:
      'The official OpenAI SDK defaults to two automatic retries with exponential backoff on HTTP 429 and 500 errors. In a browser or background daemon, this is helpful. In an interactive CLI application, silent exponential backoff looks like a completely unresponsive terminal. Setting maxRetries to 0 allows PaperCode to catch API errors immediately, format them using describeError into plain-English instructions, and prompt the user to switch models or update their credentials without frozen delays.',
    sourceFiles: ['src/providers/client.ts'],
  },
  {
    id: 'q10',
    category: 'Token Streaming',
    question: 'How does PaperCode reassemble fragmented tool call arguments across streaming SSE chunks?',
    summary: 'It maintains a partials map keyed by delta.tool_calls[i].index, concatenating string chunks until the stream terminates.',
    detailedAnswer:
      'During streaming completions, tool call fragments arrive across multiple SSE events. A single tool call arrives in pieces: chunk 0 contains the index, id, and function name, while chunks 1 through 10 stream character slices of the arguments JSON string. PaperCode allocates a Map<number, PartialToolCall>(). On each delta, it looks up the slot by tc.index, initializes it if absent, and concatenates tc.function.arguments. When the stream concludes, PaperCode extracts all entries, sorts them by index, parses the assembled JSON strings with fallback error handling, and executes them.',
    sourceFiles: ['src/agent/loop.ts'],
  },
  {
    id: 'q11',
    category: 'State & Persistence',
    question: 'Why are historical tool calls collapsed when rehydrating a past session?',
    summary: 'Replaying every previous tool output would flood the terminal scrollback with thousands of redundant lines, burying the actual conversation.',
    detailedAnswer:
      'When a user opens /sessions and resumes an earlier discussion, PaperCode reconstructs the visual transcript from the raw message history. If the previous conversation involved reading 10 files and running 5 build commands, replaying every tool output verbatim would dump thousands of lines into the terminal window, forcing the user to scroll endlessly to find past discussion. PaperCode collapses runs of tool messages into a single notice, for example "  4 tool calls", keeping the transcript clean and readable while retaining the complete message array in messagesRef.current for the LLM.',
    sourceFiles: ['src/app.tsx'],
  },
  {
    id: 'q12',
    category: 'Terminal & CLI',
    question: 'How does the composite key on <Static> solve the remount counter bug when switching sessions?',
    summary: 'Static is append-only and caches its emitted item count. Changing the composite key forces React to unmount the old instance, resetting the counter.',
    detailedAnswer:
      'Inks <Static> component is designed for performance: it records how many items it has rendered and only renders items.slice(count) on subsequent updates. When a user runs /new or resumes an existing session, the entries array is replaced with a new list of messages. Because Static remembers the previous emitted count, it would slice past the new array, displaying nothing on screen. PaperCode creates a composite key key={`${session.id}:${epoch}:${settings.showThinking}`}. When the session ID changes or an epoch bump occurs during /compact, React unmounts the previous Static component entirely, initializing a fresh instance with an emitted count of zero.',
    sourceFiles: ['src/app.tsx'],
  },
]

export function InterviewNotesSection() {
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['q1', 'q2', 'q4', 'q6']))
  const [searchQuery, setSearchQuery] = useState<string>('')

  const categories = ['All', 'Terminal & CLI', 'Token Streaming', 'Compaction', 'Security', 'State & Persistence']

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredQuestions = QUESTIONS.filter((q) => {
    const matchesCat = activeCategory === 'All' || q.category === activeCategory
    const matchesSearch =
      searchQuery === '' ||
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.detailedAnswer.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  })

  return (
    <section id="interview-qa" className="space-y-12 pt-6 border-t border-[#42433d]">
      {/* Header */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="curly-annotation text-sm text-[#abff84] font-mono">
            {'{ Systems Design Interview }'}
          </span>
          <span className="text-[#42433d]">&middot;</span>
          <span className="text-xs font-mono text-[#7c7c6f]">12 Core Architectural Questions</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[#fffce1]">
          Interview notes and architecture Q&A
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[#fffce1]/80 max-w-3xl">
          Staff and systems engineering interview questions covering terminal rendering mechanics, wire stream reassembly, invariant protection, and sandbox confinement.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#42433d] bg-[#191919] p-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-[100px] border px-3 py-1 text-xs font-mono transition-colors ${
                activeCategory === cat
                  ? 'border-[#fffce1] bg-[#0e100f] text-[#fffce1] font-semibold'
                  : 'border-[#42433d] bg-transparent text-[#7c7c6f] hover:text-[#fffce1]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#7c7c6f]" />
          <input
            type="text"
            placeholder="Search interview notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[8px] border border-[#42433d] bg-[#0e100f] pl-9 pr-3 py-1.5 font-mono text-xs text-[#fffce1] placeholder-[#7c7c6f] outline-none"
          />
        </div>
      </div>

      {/* Questions Accordion */}
      <div className="space-y-3">
        {filteredQuestions.map((q) => {
          const isExpanded = expandedIds.has(q.id)

          return (
            <div
              key={q.id}
              className="overflow-hidden rounded-[8px] border border-[#42433d] bg-[#191919]"
            >
              <button
                onClick={() => toggleExpand(q.id)}
                className="flex w-full items-start justify-between gap-4 p-5 text-left transition-colors hover:bg-[#1f1f1f]"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral" size="sm">
                      {q.category}
                    </Badge>
                    <span className="font-mono text-[11px] text-[#7c7c6f]">#{q.id}</span>
                  </div>
                  <h3 className="text-base font-semibold text-[#fffce1] tracking-tight">
                    {q.question}
                  </h3>
                  <p className="text-xs text-[#7c7c6f] leading-relaxed font-sans">
                    {q.summary}
                  </p>
                </div>

                <div className="mt-1">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ease-out ${
                      isExpanded ? 'rotate-180 text-[#fffce1]' : 'text-[#7c7c6f]'
                    }`}
                  />
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-[#42433d] bg-[#141414] p-5 text-xs text-[#fffce1] space-y-4 animate-linear-enter">
                  <div>
                    <div className="mb-1 font-semibold text-[#abff84] font-mono text-xs uppercase tracking-wider">
                      Technical Explanation
                    </div>
                    <p className="leading-relaxed text-[#fffce1]/90 font-sans text-xs">
                      {q.detailedAnswer}
                    </p>
                  </div>

                  {q.code && (
                    <div>
                      <div className="mb-1 font-semibold text-[#7c7c6f] font-mono text-xs uppercase tracking-wider">
                        Reference Code
                      </div>
                      <CodeBlock file={q.code.file} code={q.code.snippet} language="typescript" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-[#42433d] text-[11px] text-[#7c7c6f]">
                    <BookOpen className="h-3.5 w-3.5 text-[#abff84]" />
                    <span>Key source files:</span>
                    <div className="flex gap-1.5 font-mono">
                      {q.sourceFiles.map((file) => (
                        <span key={file} className="rounded-[4px] border border-[#42433d] px-1.5 py-0.5 text-[10px] text-[#fffce1]">
                          {file}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
