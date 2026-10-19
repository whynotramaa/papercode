# PaperCode interview brief

One document for the whole project. What it is, what it is built from, why each
choice was made, how a request flows through it, what breaks without each
defence, where the gaps are, and the questions you should expect.

Everything here is true at commit `9b17176`. Counts come from the commands noted
beside them.

---

## 1. The pitch

**Ten seconds.** PaperCode is a terminal coding agent. It reads and writes code,
runs commands, and searches a repo, and it works against any OpenAI-compatible
provider you point it at.

**Sixty seconds.** PaperCode is a CLI agent built on Node and React, rendered in
the terminal with Ink. You bring a base URL and an API key, so the same binary
talks to OpenAI, OpenRouter, Groq, Together, DeepSeek, or a local Ollama. The
agent core is a streaming loop that reassembles tool calls out of server-sent
event fragments, runs them through a schema-validated tool layer, and appends
the results to the message history. Three things guard the user. Path arguments
are confined to the launch directory, a PLAN mode withholds and then refuses
every mutating tool, and anything that writes a file or runs a command prompts
for approval first. Sessions are JSON files on disk, written atomically, and
resumable. The test suite is 153 tests, including an end-to-end suite that runs
the real stack over real HTTP against a mock provider.

**If they ask what is interesting about it.** The hard parts were not the LLM
call. They were terminal rendering that does not duplicate frames, keeping the
message history valid when the user hits Escape mid-tool-call, and cutting the
history for compaction without orphaning a tool result.

---

## 2. Repo map

```
src/
  cli.tsx          entry: arg parsing, terminal setup, kitty protocol lifecycle
  app.tsx          root component: view state, send loop, command routing
  agent/
    loop.ts        the streaming turn loop
    messages.ts    message and event types
    compact.ts     summarization and the safe split
    systemPrompt.ts base prompt, mode note, environment block
  tools/
    types.ts       Tool shape, output truncation
    index.ts       registry, schema validation, approval gate, dispatch
    permissions.ts mode gate, path confinement, bash screen, ApprovalStore
    read.ts write.ts edit.ts ls.ts glob.ts grep.ts bash.ts
  providers/
    client.ts      OpenAI client construction, error translation
    models.ts      model discovery, ranking, provider presets
  config/
    paths.ts       every path under ~/.papercode, PAPERCODE_HOME override
    jsonFile.ts    atomic read and write
    auth.ts        providers and keys
    settings.ts    active provider, model, theme, custom prompt
    skills.ts      global and project skills, precedence, reserved names
  sessions/
    store.ts       session JSON, titles, listing, deletion
  ui/
    commands.ts    command table, aliases, palette filtering
    keyboard.ts    kitty keyboard protocol detection and push/pop
    markdown.ts    themed terminal markdown
    useViewport.ts terminal size and list capacity
    brand.ts themes/ components/ views/

papercode-web/     a Vite + React 19 + Tailwind 4 site that explains the above
```

Source size: 6,449 lines in `src/` and 3,753 in `papercode-web/src/`.
Regenerate with `find src -type f | xargs wc -l | tail -1`.

---

## 3. Tech stack and why

| Choice | Why this | What was rejected and why |
| --- | --- | --- |
| TypeScript, strict, `noUncheckedIndexedAccess` | The message history is a discriminated union with strict invariants. The compiler catches an unanswered tool call shape before the API does. | Plain JS. The tool schemas and message unions are the whole design. |
| Node 20+, ESM | `AbortController`, `AbortSignal` on `spawn` and `fetch`, and top-level await are all native. | CommonJS. Ink 5 and chalk 5 are ESM-only. |
| Ink 5 (React for the terminal) | Terminal UI becomes a declarative state machine. Flexbox layout comes from Yoga. `ink-testing-library` renders headless and lets tests write to stdin and assert on frames. | `blessed` or raw curses. Both make you own cursor coordinates and dirty-rectangle erasure by hand, and neither is testable without a pty. |
| React 18 (not 19) | Ink 5 targets the React 18 reconciler. | React 19 in the CLI. The web project uses 19 because it renders to a DOM. |
| The official `openai` SDK | Every target provider speaks the same wire protocol, so one SDK covers all of them. It handles SSE parsing, abort plumbing, and typed message params. | Hand-rolled `fetch` plus an SSE parser. That is real work for no gain, and the SDK's `ChatCompletionMessageParam` type is what keeps the history honest. |
| Zod plus `zod-to-json-schema` | One schema per tool produces both the JSON Schema sent to the model and the runtime parser that validates what comes back. They cannot drift. | Hand-written JSON Schema next to a hand-written validator. Two sources of truth for the same contract. |
| `fast-glob` | Used for `glob`, for the JS fallback in `grep`, and for `@` mention completion. Handles ignore patterns and symlink safety. | `fs.readdir` recursion. Reimplementing glob matching and ignore handling is not worth it. |
| ripgrep when present, JS fallback otherwise | `rg` is dramatically faster on a large repo. The fallback means the tool never simply fails on a machine without it. | Requiring ripgrep. A coding agent that breaks on a bare container is a bad coding agent. |
| `marked` plus `marked-terminal` | Model output is markdown. These render it to ANSI. | Printing raw markdown, or writing a renderer. |
| tsup (esbuild) | One ESM bundle with a shebang, built in under a second. | tsc for emit, or webpack. Slower for no benefit here. |
| vitest | Native ESM and TypeScript, no transform config, and it runs the Ink tests unchanged. | Jest. ESM support is still friction. |
| JSON files under `~/.papercode/` | Inspectable with `cat`, greppable, diffable, and zero setup. | SQLite. A key-value store with a few hundred rows does not need a database. The original brief said `localStorage`, which a terminal process does not have. |

### The dependency budget

Twelve runtime dependencies. Each earns its place, and there is no utility
library, no state manager, and no logging framework. The strongest signal of
restraint is what is absent. There is no dependency injection container, no
plugin system, no event bus. The agent loop takes a client, a message array, a
tool executor, and a callback, which is all the indirection the design needs.

---

## 4. Architecture

One rule governs the layout.

**The agent core knows nothing about the terminal, and the tools know nothing
about approval.**

`runTurn` in `src/agent/loop.ts` takes a client, a model name, a message array,
tool definitions, a tool executor function, an `AbortSignal`, and an event
callback. It has no React import and no console output. `executeTool` in
`src/tools/index.ts` takes a `requestApproval` function as a parameter instead
of prompting for itself.

Two things follow from that rule.

First, `src/e2e.test.ts` drives the entire stack, real HTTP and real files, with
`requestApproval: async () => true`. No terminal involved.

Second, moving PaperCode to a web UI or a daemon means replacing `src/ui/` and
`src/app.tsx`. Nothing under `agent/`, `tools/`, `providers/`, or `config/`
changes.

```
                    ┌─────────────────────────────────────────┐
  keystrokes  ─────►│  Editor  →  app.tsx  →  send()          │
                    └──────────────────┬──────────────────────┘
                                       │ messages, tools, signal
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │  agent/loop.ts  runTurn()               │
                    │  streams SSE, reassembles tool calls    │
                    └──────┬───────────────────────┬──────────┘
                           │ events                │ tool calls
                           ▼                       ▼
                  ┌────────────────┐    ┌──────────────────────┐
                  │  Ink render    │    │  tools/index.ts      │
                  │  Static + live │    │  mode gate → zod →   │
                  └────────────────┘    │  approval → run      │
                                        └──────────┬───────────┘
                                                   │
                                        ┌──────────▼───────────┐
                                        │  fs, spawn, ripgrep  │
                                        └──────────────────────┘
```

---

## 5. One message, end to end

Trace this out loud when asked how it works. It covers most of the design in a
single pass.

1. **The user types and presses Enter.** `Editor` validates that the buffer is
   non-empty, pushes it onto a 100-entry local history ring, clears itself, and
   calls `onSubmit`.

2. **`send()` builds the request.** `buildSystemPrompt(mode, cwd)` produces the
   base prompt, a PLAN or BUILD note, an environment block with the working
   directory, platform, OS release, and date, and any custom `systemPrompt` from
   settings appended last with "these take priority". The system message is
   rebuilt and overwritten at index 0 every turn, so toggling Tab changes the
   model's instructions immediately rather than at the next session.

3. **The history lives in a ref, not state.** `messagesRef.current` is a
   `useRef`. The agent loop mutates it in place. Storing it in `useState` would
   re-render the whole tree on every token.

4. **A fresh `AbortController` per turn.** The signal reaches the SDK request,
   the tool context, and the spawned child process.

5. **`runTurn` opens the stream.** Up to `maxSteps` (25) iterations. Each
   iteration opens one streaming chat completion.

6. **Deltas arrive.** Reasoning text under either `reasoning_content` or
   `reasoning` is emitted as a `thinking` event, because providers disagree on
   the field name. Content deltas append to a local buffer and emit a `text`
   event. Tool-call fragments accumulate into a `Map<number, PartialToolCall>`
   keyed by `index`.

7. **The stream drains.** If no tool calls accumulated, the assistant message is
   appended and the turn ends. Otherwise the partials are sorted by index,
   filtered to those that got a name, given a synthetic id if the provider
   omitted one, and pushed as a single assistant message carrying `tool_calls`.

8. **Each call runs in order.** Before each one, the loop rechecks the abort
   signal. `executeTool` looks up the tool, applies the mode gate, parses the
   arguments as JSON, validates them against the Zod schema, requests approval
   if the tool is not read-only, and runs it.

9. **A tool result message is appended for every call.** No exceptions. This is
   the invariant the API enforces and the one an interrupt is most likely to
   break.

10. **The loop iterates.** The model sees the results and either calls more
    tools or answers.

11. **The turn ends.** `finally` clears busy state, re-estimates the token
    count, and persists the session to `~/.papercode/sessions/<id>.json` by
    atomic rename.

---

## 6. Subsystems, decisions, and what breaks without them

### 6.1 Terminal rendering

**The duplicate frame problem.** Ink erases a frame by emitting `\x1b[NA`, which
moves the cursor up N rows and overwrites. If N is larger than the terminal is
tall, the bottom of the frame pushes the top of it into the scrollback buffer.
A terminal will not move the cursor above row zero into scrollback. The cursor
stops at the top of the visible screen, the old frame is stranded above, and the
new frame draws below it. To the user, the panel duplicates on every keystroke.

**The fix has three parts.** Finished output goes into Ink's `<Static>`, which
writes once and leaves the scrollback to the terminal. Lists window themselves
through `useViewport()` and `listCapacity(rows, 12)`, so a 200-item list renders
about eight rows and a count. Tests assert the height of every always-visible
panel.

`src/ui/ui.test.tsx` holds the guard:

```ts
const MAX_ROWS = 20;

it("keeps the provider list short enough for Ink to erase", async () => {
  const app = wrap(<Connect onDone={() => {}} onCancel={() => {}} />);
  await tick();
  expect(heightOf(app.lastFrame())).toBeLessThanOrEqual(MAX_ROWS);
});
```

Be precise about this in an interview. `MAX_ROWS = 20` is a **test** constant,
not a runtime cap. Nothing in the app clamps a panel to 20 rows. The runtime
mechanism is `listCapacity`, and the constant is the regression guard that
fails the build if a panel grows past what a 24-row terminal can erase.

**The `<Static>` remount bug.** `<Static>` is append-only by design. It records
how many items it has emitted and renders only `items.slice(count)`. `/new` and
resuming a session both replace the entries array wholesale. `<Static>` would
slice past the end of the new array and render nothing, leaving the previous
session's transcript on screen under the new session's name.

The fix is a composite key:

```tsx
<Static key={`${session.id}:${epoch}:${settings.showThinking}`} items={entries}>
```

Each part exists for a reason. `session.id` changes on `/new` and on resume.
`epoch` is a counter that `/compact` bumps, because compaction replaces the
transcript with a receipt while the session id stays the same. `showThinking`
changes on Ctrl+T, which needs the transcript reprinted expanded or collapsed.
Changing the key unmounts the old instance, so the new one starts with an
emitted count of zero.

### 6.2 Keyboard and the Shift+Enter problem

A classic TTY sends carriage return (`0x0D`) for Enter whether or not Shift is
held. The modifier is discarded by the line discipline. Shift+Enter for a
newline is therefore not implementable on a classic terminal, no matter how the
application is written.

Modern terminals implement the kitty progressive keyboard protocol, which
reports modified keys distinctly. `src/ui/keyboard.ts` detects Kitty, Ghostty,
and WezTerm through environment variables and `TERM`, then writes `\x1b[>1u` to
push the protocol. Everywhere else, Ctrl+J is offered instead, because it
transmits line feed (`0x0A`), a genuinely distinct byte.

Two details matter and both are easy to get wrong.

`src/cli.tsx` registers the pop sequence `\x1b[<u` on `exit`, `SIGINT`, and
`SIGTERM`. Skipping that on a crash leaves the user's shell with broken key
handling after PaperCode is gone.

`newlineKeyLabel()` returns "Shift+Enter" or "Ctrl+J" depending on detection, so
`/help` and the editor hint line tell the truth about the terminal in front of
the user rather than printing a shortcut that does nothing.

### 6.3 Streaming and tool-call reassembly

Tool calls do not arrive whole. The first fragment usually carries the index,
the id, and the function name. The arguments arrive as a JSON string split
across later fragments, sometimes character by character, and parallel calls
interleave. The only stable correlation is `delta.tool_calls[i].index`.

```ts
for (const tc of delta?.tool_calls ?? []) {
  const slot = partials.get(tc.index) ?? { id: "", name: "", args: "" };
  if (tc.id) slot.id = tc.id;
  if (tc.function?.name) slot.name += tc.function.name;
  if (tc.function?.arguments) slot.args += tc.function.arguments;
  partials.set(tc.index, slot);
}
```

The name concatenates rather than assigns, because some providers split the name
too. The id assigns, because it arrives once. Parsing a partial JSON string
mid-stream would fail, so parsing happens only after the stream drains. A parse
failure there falls through to `{}` on purpose, because the Zod validation
downstream produces a better error message for the model than a raw
`SyntaxError` would.

The agent test suite has a case that streams a single tool call in one-character
chunks, and another that interleaves two calls at different indexes.

### 6.4 Interrupts and the dangling tool call

This is the sharpest bug in the codebase and a good thing to volunteer.

The OpenAI protocol requires that an assistant message carrying `tool_calls` is
followed by one tool result message per call id. Send a history that violates
that and the next request fails with a 400, permanently, because the bad
history is now stored.

A user pressing Escape while three tool calls are pending is exactly how that
history gets created. A loop that just returns leaves three unanswered ids.

```ts
for (const [i, call] of calls.entries()) {
  if (signal.aborted) {
    // Every remaining call still needs a result message or the next request
    // is rejected for an unanswered tool_call id.
    for (const pending of calls.slice(i)) messages.push(abortedToolResult(pending.id));
    onEvent({ type: "turn_end", reason: "aborted" });
    return { reason: "aborted" };
  }
  // ...
}
```

`abortedToolResult` writes "Interrupted by the user before this tool finished."
That text is for the model, not the user. It reads on the next turn as an
explanation rather than a mystery.

There is a second abort check that is easy to miss and is the one that took the
longest to find. The stream can drain completely before the abort takes effect,
on a fast response or a provider that flushes everything at once. Without a
recheck after the read loop, the turn reports "done" and proceeds to run the
tool calls the user just interrupted.

```ts
// The stream can drain before an abort takes effect ...
if (signal.aborted) {
  if (text) messages.push({ role: "assistant", content: text });
  onEvent({ type: "turn_end", reason: "aborted" });
  return { reason: "aborted" };
}
```

The partial assistant text is kept in every abort path. Throwing it away would
lose what the model already said.

### 6.5 The tool layer

Seven tools. `read`, `ls`, `glob`, and `grep` are read-only. `write` and `edit`
are mutating. `bash` is dangerous. Each tool is one object.

```ts
export type Tool<S extends z.ZodType> = {
  name: string;
  description: string;
  schema: S;
  permission: PermissionLevel;
  target?: (args: z.infer<S>) => string | undefined;
  preview?: (args: z.infer<S>) => string;
  run: (args: z.infer<S>, ctx: ToolContext) => Promise<ToolResult>;
};
```

`description` is prompt engineering, not documentation. The model reads it to
decide what to call. The `bash` description explicitly steers toward the
dedicated tools and warns that commands run non-interactively.

`target` produces the approval key, so approving `write` for one file does not
approve it for another. `preview` produces the one line shown in the approval
prompt. `permission` drives the mode gate and whether approval is needed at all.

**`executeTool` runs five checks in a fixed order.** Unknown name, then mode
gate, then JSON parse, then Zod validation, then approval. Each failure returns
`isError: true` with text written for the model to act on, not for a human to
read in a log. The order matters. The mode gate comes before the parse so a
blocked tool never has its arguments inspected, and approval comes last so the
user is never asked to approve a call that was going to fail validation anyway.

**Every failure message tells the model what to do next.** This is the design
philosophy of the whole layer. The `edit` tool does not say "no match". It says
the text must match exactly including indentation and line endings, and to
re-read the file and copy the target text from the output, because whitespace
drift is the overwhelmingly common cause. An ambiguous match reports the count
and offers `replace_all`. A denied approval says "do not retry it" and suggests
asking the user. Vague errors cause retry loops, and a retry loop costs tokens
and wall-clock time.

**Output is capped at 30,000 characters** by `truncate`, with a footer telling
the model how many characters were dropped and to narrow the query or use
`offset`. An untruncated `grep` on a large repo can exhaust a context window in
one call.

**Tool-specific decisions worth naming.**

`read` numbers every line, so the model can cite line numbers back. It refuses
binary files two ways, by extension and by scanning the first 8,000 bytes for a
NUL byte. It defaults to 2,000 lines and reports the range shown.

`glob` sorts newest-modified first, because a model orienting in an unfamiliar
repo almost always wants the recently touched files.

`grep` probes `rg --version` once, caches the answer in a module-level variable,
and falls back to a `fast-glob` plus `RegExp` scan. It treats ripgrep exit code
1 as "no matches" rather than an error, which is a real bug if you miss it.

`bash` detaches stdin entirely, so an interactive prompt hits EOF and exits
instead of hanging on a TTY the agent cannot type into. It sets
`GIT_TERMINAL_PROMPT=0` for the same reason. It defaults to a 120-second timeout
and kills with SIGKILL. A non-zero exit code is reported as information, not
swallowed as a PaperCode failure, because a failing test suite is exactly what
the model needs to read.

### 6.6 Permissions and safety

Four independent layers. The point is that no single one is trusted.

**1. Mode gate.** PLAN mode withholds `write`, `edit`, and `bash` from the tool
definitions sent to the model, and `executeTool` refuses them again at the call
site. Withholding is a prompt optimization. The runtime check is the guarantee.
Models hallucinate tools they were never given, so a design that relies only on
withholding executes the hallucination. The refusal text also tells the model to
stop trying for the rest of the turn and to ask the user to press Tab.

**2. Path confinement.**

```ts
const resolved = path.resolve(root, input);
const rel = path.relative(root, resolved);
const escapes = rel.startsWith("..") || path.isAbsolute(rel);
```

Resolve first, then measure the distance back. This handles `../../etc/passwd`,
an absolute path to somewhere else, and the case a naive `startsWith(root)`
check gets wrong, where `/home/user/project-backup` passes a prefix test against
root `/home/user/project`. There is a test for exactly that sibling-prefix case.

**3. Bash screening.** A five-pattern deny list covers recursive deletion of
`/`, `mkfs`, raw writes to a block device, and the classic fork bomb. Be honest
about what this is. It is a guard against an obvious catastrophe, not a sandbox.
A blocklist over a shell language is bypassable by anyone trying. The real
boundary is layer four.

**4. Approval prompt.** Every mutating and dangerous call stops and asks, with a
preview of the exact command or the exact file. Three options: once, always for
this target this session, or no. Escape means no, matching what Escape means
everywhere else in the app. Approvals are scoped by tool name plus target, so
approving `write` on `README.md` does not approve `write` on `.env`. The store
is in-memory only and clears on `/new` and on resume, so nothing persists
approval across sessions.

**Where the sandbox ends.** Path confinement applies to the file tools. It does
not apply to `bash`. The `bash` tool spawns with `cwd: ctx.root`, but nothing
stops a command from running `cd /` once it is running. That is a deliberate
trade-off, because a coding agent that cannot run `npm install` or `git log` is
not useful, and the approval prompt is what stands in front of it. Say this
plainly if asked. Claiming `bash` is sandboxed when it is not is a worse answer
than naming the limit.

### 6.7 Providers

Every target speaks the OpenAI wire protocol, so the abstraction is a base URL
and a key. `PRESETS` ships six of them and a custom option.

**`maxRetries: 0`.** The SDK retries twice with exponential backoff by default.
In a server that is helpful. In an interactive terminal a silent backoff is
indistinguishable from a hang. The UI owns retries so that a 429 becomes a
readable line immediately.

**`describeError` translates by status code.** A 401 says the key looks invalid
and to run `/connect`. A 404 says the model may not exist at this provider or
the base URL may be wrong, which are the two actual causes. A connection error
says to check the base URL and the connection. Raw SDK errors leak internals and
tell a user nothing actionable.

**`normalizeBaseURL` strips trailing slashes and a pasted
`/chat/completions` suffix**, because people copy that URL out of provider docs
constantly and the resulting 404 is baffling.

**Model discovery** calls `/v1/models`, filters out embeddings, audio, image,
moderation, and rerank models by regex, and ranks the current frontier families
first. If the endpoint has no model list, which is common for a proxy, `Connect`
falls through to a manual model entry step instead of dead-ending. The filter
and the fallback both have e2e tests.

### 6.8 Storage

Everything lives under `~/.papercode/`, relocatable with `PAPERCODE_HOME`.

```
auth.json           providers and API keys, written 0600
settings.json       active provider and model, theme, custom system prompt
skills.json         global skills
sessions/<id>.json  one file per conversation
```

**Every write is atomic.** `writeJson` writes to `<file>.<pid>.tmp` and then
calls `fs.renameSync`. On POSIX, `rename(2)` is atomic, so a reader sees either
the old complete file or the new complete file, never a half-written one. A
direct `writeFileSync` that is interrupted by SIGKILL or a crash leaves
truncated JSON, and the next launch fails to parse it. The `.pid.` in the temp
name means two PaperCode processes do not collide on the same temp path. A test
asserts no temp file is left behind.

**Every read is total.** `readJson` returns a fallback on any failure, and every
caller validates the parsed result with a Zod schema before using it. A corrupt
`auth.json` yields an empty provider list, not a crash. A corrupt session file is
skipped and the rest of the list still renders. A `theme` value that no longer
exists falls back to the default through `z.enum(...).catch(DEFAULT_THEME)`.
There are tests for each of those three.

**Keys are stored at mode 0600**, owner read and write only. See the gaps
section for the honest limit on that.

### 6.9 Sessions

A session is an id, a title, a cwd, timestamps, the provider and model in use,
and the full message array. The id is a UTC timestamp plus six random
characters, so it sorts chronologically and does not collide.

The title is derived from the first user message, whitespace-collapsed and
truncated at 60 characters. No extra model call, and no field for the user to
fill in.

`listSessions` hides sessions with zero messages, because those are launches
someone abandoned and they are noise in the picker.

**Resuming rebuilds the transcript, it does not replay it.** Runs of tool calls
collapse to a single line like `4 tool calls`. A previous conversation that read
ten files and ran five builds would otherwise dump thousands of lines into the
terminal and bury the actual conversation. The full message array still goes to
`messagesRef.current` untouched, so the model loses nothing. The user sees a
readable transcript, the model sees complete history.

### 6.10 Compaction

`estimateTokens` counts characters across content and `tool_calls` and divides
by four. The header shows that against an assumed 128,000-token window, and a
warning appears at 80 percent.

`/compact` asks the model to summarize the older messages with a prompt that
names what to capture, goal in the user's words, files touched with paths,
decisions and constraints, and the immediate next step, and closes with the line
that does the real work: "This summary replaces the messages it covers, anything
you leave out is lost."

The result is spliced back as the system message, then a user message carrying
the summary under an `[Earlier conversation, summarized]` marker, then a short
assistant acknowledgement, then the recent messages. The acknowledgement exists
so the history alternates correctly and the model treats the summary as
established context rather than a fresh instruction.

**`safeSplitIndex` is the interesting part.** Cutting the history at an
arbitrary index can sever an assistant message that requested tool calls from
the tool messages that answered them. That produces two invalid message arrays.
The summarized half ends with unanswered tool calls. The kept half begins with
orphaned tool results. Either one is a 400 from the API.

```ts
export function safeSplitIndex(messages: ChatMessage[], preferred: number): number {
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
}
```

Walk backward until the message at the cut is not a tool result and the message
before the cut does not carry tool calls. Backward and not forward, because
moving forward would drop a tool result whose call is already in the summarized
half. The loop terminates at zero in the worst case, which means summarizing
everything, which is valid.

**Two failure guards.** If the model returns an empty summary, the history is
returned untouched rather than dropped. If nothing needs summarizing, the call
is a no-op. Losing a conversation to a failed summarization request would be the
worst possible bug in this feature.

After a successful compaction the screen and scrollback are cleared and the
transcript is replaced by a single receipt showing the message count and the
before and after token estimates. The transcript above no longer matches the
history the model sees, so leaving it on screen would be a lie.

### 6.11 Skills

A skill is a named prompt invoked as a slash command. Three fields: name,
description, prompt.

Global skills live at `~/.papercode/skills.json` and project skills at
`.papercode/skills.json`. Both load, and a project skill overrides a global one
of the same name, because a repo-specific review prompt should win over a
personal default. That is one `Map` keyed on the lowercased name, filled from
global first and then project.

Built-in command names are reserved and rejected with an explanation. Silently
ignoring a skill named `help` would be baffling to whoever wrote it. The
reserved list includes aliases, so `login` and `logout` are reserved even though
the commands are named `connect` and `disconnect`.

An invalid entry is skipped and reported by index and reason, and the valid
entries in the same file still load. One typo should not disable a file.

### 6.12 Themes

A theme is a set of semantic tokens. `primary`, `muted`, `faint`, `success`,
`warning`, `error`, `diffAdd`, and so on. No component references a hex value.
Four themes ship, and adding a fifth is a data change in one object rather than
a grep through the components.

`/theme` previews live as the highlight moves, through the `onHighlight`
callback on `Select`, and Escape reverts to the saved theme rather than leaving
the preview applied.

One subtlety worth knowing. `vitest.config.ts` sets `FORCE_COLOR: "3"`, because
chalk and Ink strip color when stdout is not a TTY, which it never is under a
test runner. Without it every theme renders identically and the theme tests
assert nothing.

---

## 7. Testing

153 tests in six files. Run `npx vitest run` to confirm the count.

```
src/ui/ui.test.tsx        63  editor, palette, Select, Header, panel heights, themes
src/config/config.test.ts 33  auth, settings, skills precedence, sessions, corruption
src/tools/tools.test.ts   28  path escape, mode gate, bash screen, edit semantics
src/e2e.test.ts           12  the whole stack over real HTTP against a mock provider
src/agent/agent.test.ts   11  streaming, reassembly, abort invariants, safe split
src/app.test.tsx           6  first-run routing, theme loading, resume rendering
```

(The `it.each` over four themes in `ui.test.tsx` expands one block into four
cases, which is why a `grep -c` of `it(` returns 150 rather than 153.)

**The test strategy is one sentence.** Test the things that fail quietly.

A frame one row too tall does not throw, it just renders a duplicate panel that
nobody notices until a user complains. A split that orphans a tool result does
not throw, it 400s three turns later. An input field that does not clear between
Connect steps does not throw, it silently sends the base URL as the API key.
Each of those has a test.

**`src/e2e.test.ts` is the piece worth describing.** It stands up a real
`http.Server` that speaks SSE, scripts the deltas it will return, and runs
`runTurn` plus `executeTool` against a real temp directory. It asserts that a
file actually appears on disk after a tool call, that PLAN mode both omits the
tools from the outgoing payload and refuses the call if the model makes it
anyway, that a denied approval leaves the disk untouched, that a path escape is
rejected with a message the model can act on, that history stays sendable after
a malformed tool call, and that an abort mid-stream leaves a valid history. No
mocking of the SDK, no mocking of `fs`. The only fake thing is the model.

---

## 8. Trade-offs, stated as decisions

Interviewers ask "why not X". These are the answers, with the cost admitted.

**Why not the Anthropic SDK, or a provider abstraction layer?** The OpenAI chat
completions protocol is the one every provider implements, including Anthropic
through a compatibility endpoint. One protocol means no abstraction layer, which
means no interface with one real implementation. The cost is that
provider-specific features are out of reach, and prompt caching is the one that
actually hurts.

**Why not persist approvals across sessions?** Because an approval granted
yesterday, for a repo you have since changed, is not informed consent. The cost
is repeated prompting. If it became annoying, the fix is a per-project allowlist
file the user edits, not silent memory.

**Why an in-memory `ApprovalStore` rather than a config file?** Same reason, and
it keeps the store a 25-line class with no I/O and no failure modes.

**Why `maxSteps: 25`?** A model in a retry loop will happily burn a context
window and a spending limit. Twenty-five tool calls is far more than a real task
needs and low enough to cap the damage. The cost is that a genuinely long task
stops early, and the message says so rather than pretending to finish.

**Why estimate tokens instead of using a tokenizer?** A real tokenizer is a
multi-megabyte dependency per model family, and the number drives a progress bar
and a warning banner, not a billing decision. Characters over four is within
about 10 percent for code and English. The cost is that the percentage is
approximate, which is fine for what it is used for.

**Why JSON files instead of SQLite?** A few hundred rows and no queries beyond
"list by date". JSON is inspectable with `cat` and greppable, which matters for
a developer tool. The cost is that `listSessions` reads and parses every file,
which is fine at a hundred sessions and would not be at ten thousand.

**Why `React.useRef` for the message history?** It is mutated in place by code
that is not a React component, and re-rendering the tree on every appended token
would be both slow and pointless. The cost is that it sits outside React's data
flow, so anything that needs to react to a history change, like the token count,
is updated explicitly at the turn boundary.

---

## 9. Known gaps, and the answer to give

Volunteer these. A candidate who names the limits of their own system reads as
senior. A candidate who says "it's secure" does not.

**`ApprovalStore.grantAllEdits()` is dead code.** The class supports a blanket
grant for all mutating tools, but nothing calls it. The approval prompt's
"don't ask again this session" option calls `grant(tool.name, target)`, which is
scoped to that one file. So approving a second file prompts again. Either wire
the blanket option up as a fourth choice or delete the method. It is the one
piece of speculative code in the repo.

**Compaction is manual only.** The header warns at 80 percent, but nothing
triggers `/compact` automatically. The pieces are all there, which is the point
of `estimateTokens` and the threshold constant. Next step is to call `doCompact`
from the turn boundary when the estimate crosses the threshold.

**`ASSUMED_CONTEXT = 128_000` is hardcoded.** Real windows range from 8,000 to
over a million. The provider's model list does not return context length, so the
fix is a lookup table for known models with 128,000 as the fallback.

**The atomic write is atomic but not durable.** `writeJson` renames without
calling `fsync` on the file or the parent directory. A reader never sees a
partial file, which is the property that matters here. Power loss immediately
after the rename can still lose the write on some filesystems. Adding `fsync`
would cost a few milliseconds per turn. For a session log it is not worth it,
and I would add it without hesitation for anything a user cannot retype.

**API keys are plaintext at 0600.** That protects against other users on the
machine. It does not protect against anything running as the same user, which
includes every npm postinstall script that user ever runs. The real fix is the
OS keychain through `keytar` or the platform CLI, which is a native dependency
and a cross-platform support burden. For a local developer tool that already
grants shell execution, 0600 is the proportionate choice, and I would not ship
it that way for a team product.

**`bash` is not confined to the working directory.** Covered in 6.6. The
approval prompt is the boundary, not the filesystem.

**The `@` mention file cache never invalidates.** `useFileSuggestions` globs the
tree once into a module-level variable. A file created during the session does
not appear in completions until restart. A watcher or a short TTL fixes it.

**`listSessions()` is called inline in JSX,** so it reads and parses every
session file on each render of the sessions view. Same for `listProviders()` in
the App body, which reads `auth.json` on every render of the app. Neither is
measurable at the current scale, and both should move into `useMemo` or state.

**Two unused exports.** `addManualModel` in `providers/models.ts` (Connect calls
`upsertProvider` directly) and `extractCodeBlocks` in `ui/markdown.ts`. Delete
them.

**No integration test for `bash`.** The process handling, the timeout, the
SIGKILL on abort, and the stdin detach are all untested. They are also the
hairiest code in the tools directory. That is the gap I would close first.

**Not built, deliberately.** Sub-agents, MCP support, web fetch, git integration
beyond `bash`, multi-file atomic edits, and streaming diffs. Each is a real
feature, and none of them is the core loop.

---

## 10. Question bank

### Terminal and Ink

**Why React in a terminal instead of blessed or curses?**
Ink makes terminal UI a declarative state machine with flexbox layout from Yoga,
so there are no hand-computed cursor coordinates and no manual dirty-rectangle
erasure. It also makes the UI testable. `ink-testing-library` renders headless,
writes to stdin, and returns the frame as a string, so an interaction test is a
unit test with no pty. The cost is React's reconciler overhead per frame, which
is irrelevant at terminal refresh rates.

**Why does a terminal UI duplicate its panel, and how do you stop it?**
See 6.1. Frame taller than the terminal, cursor cannot climb into scrollback,
old frame stranded. Fixed with `<Static>`, list windowing through `useViewport`,
and a height assertion in the test suite.

**What is `<Static>` and why does it need a key?**
`<Static>` writes items once and hands the scrollback to the terminal, so
finished output leaves the re-render path entirely. It is append-only and caches
its emitted count, so replacing the items array renders nothing. The composite
key `${session.id}:${epoch}:${settings.showThinking}` forces a remount whenever
the array is replaced rather than appended.

**Why can't you bind Shift+Enter?**
The TTY line discipline sends `0x0D` for Enter with or without Shift. PaperCode
pushes the kitty keyboard protocol with `\x1b[>1u` on terminals that support it,
falls back to Ctrl+J, which sends `0x0A`, and pops the protocol on every exit
path so the user's shell is not left broken.

### Streaming and the agent loop

**How do you reassemble a tool call from SSE fragments?**
A `Map` keyed by `delta.tool_calls[i].index`. Name and arguments concatenate, id
assigns. Parsing happens only after the stream drains, because partial JSON does
not parse. Parallel calls stay separate because they carry different indexes.

**What happens if the user hits Escape mid-tool-call?**
Every remaining call gets a synthetic tool result message, because the API
rejects an assistant `tool_calls` message with an unanswered id. There is a
second abort check after the stream drains, because a fast stream can complete
before the abort lands and the turn would otherwise run the calls the user just
cancelled.

**Why `maxRetries: 0` on the client?**
Silent SDK backoff is indistinguishable from a hang in an interactive terminal.
Errors surface immediately, translated by `describeError` into a line that says
what to do.

**How do you handle a model that returns malformed tool arguments?**
The JSON parse failure falls through to `{}` deliberately, and Zod validation
produces the error. The message names each failing field and its reason, which
the model can act on. The e2e suite asserts the history stays sendable after a
malformed call.

### Context and compaction

**Walk me through compaction.**
See 6.10. Summarize the old messages, keep the recent ones, splice with a
marker and an acknowledgement, and never cut through a tool call.

**Why is a naive slice unsafe?**
It separates an assistant `tool_calls` message from its results, producing two
invalid arrays, one with unanswered calls and one with orphaned results.
`safeSplitIndex` walks backward until both conditions clear.

**Why backward and not forward?**
Forward would leave a tool result behind whose originating call is already in
the summarized half. Backward keeps the pair together on the kept side.

### Safety

**Why enforce PLAN mode twice?**
Withholding tools from the schema is a prompt optimization and models
hallucinate tools they were never given. The runtime `checkMode` inside
`executeTool` is the guarantee. Defence in depth, with the untrusted layer on
the outside.

**How do you prevent path traversal?**
`path.resolve` then `path.relative`, and reject if the result starts with `..`
or is absolute. That catches the sibling-prefix case, where root
`/home/u/project` and target `/home/u/project-backup` pass a naive
`startsWith`. There is a test for it.

**Is the bash tool sandboxed?**
No, and I would not claim it is. It spawns with `cwd` set to the working
directory, but nothing stops a `cd`. The deny list blocks five catastrophic
patterns and is not a security boundary, because a blocklist over a shell is
bypassable. The approval prompt, showing the exact command, is the boundary.
Real isolation means a container or a seccomp profile, which is a different
product.

**Why scope approvals per target?**
Approving `write` on `README.md` should not approve `write` on `.env`. The key
is tool name plus target, and the store clears on `/new` and on resume.

### Architecture and testing

**How would you add a new tool?**
One file in `src/tools/`, exporting a Zod schema, a description written for the
model, a permission level, `target`, `preview`, and `run`. Add it to
`ALL_TOOLS`. The JSON Schema, the mode gate, the validation, the approval flow,
and the error handling all come from the registry.

**How would you port this to a web UI?**
Replace `src/ui/` and `src/app.tsx`. Nothing in `agent/`, `tools/`,
`providers/`, or `config/` imports React or touches stdout. That separation is
what lets the e2e suite drive the whole stack with no terminal at all.

**What is the hardest bug you fixed?**
The abort recheck after the stream drains. The symptom was that interrupting a
fast response still ran the tool calls, which looked like the Escape key not
working. The cause was that the abort signal fired after the stream had already
completed, so the loop read `aborted` as false during the read and never
rechecked before dispatching. One `if` block, found by writing the test that
aborts between stream end and tool dispatch.

**What would you build next?**
Automatic compaction at the threshold, a per-model context table, and an
integration test for `bash`, in that order. Then MCP support, because it turns
the tool layer from seven fixed tools into anything the user can connect.

---

## 11. Whiteboard diagrams

**The turn loop.**

```
  send(text)
      │
      ├─► rebuild system prompt at messages[0]   (mode changes take effect now)
      ├─► push user message
      ├─► new AbortController
      │
      ▼
  runTurn ──────────── step 0..24 ─────────────────────────┐
      │                                                     │
      ├─ open stream                                        │
      ├─ for each chunk:                                    │
      │     reasoning  → thinking event                     │
      │     content    → text event, append buffer          │
      │     tool_calls → partials.set(index, merged slot)   │
      │                                                     │
      ├─ if aborted after drain → synthesize, return        │
      ├─ if no calls → push assistant, return done          │
      │                                                     │
      ├─ push assistant message with tool_calls             │
      └─ for each call:                                     │
            aborted? → answer all remaining, return         │
            parse args → executeTool → push tool result ────┘
```

**The tool gate.**

```
  call ─► known name? ──no──► "Unknown tool. Available: ..."
            │yes
            ▼
          mode gate ──blocked──► "PLAN mode is read-only. Do not retry."
            │allowed
            ▼
          JSON.parse ──fail──► "Arguments were not valid JSON."
            │ok
            ▼
          zod.safeParse ──fail──► "Invalid arguments, field: reason"
            │ok
            ▼
          read-only? ──yes──► run
            │no
            ▼
          approval ──deny──► "User denied. Do not retry."
            │allow
            ▼
          run → { content, isError, display }
```

**Compaction.**

```
  before:  [sys][u][a+calls][tool][tool][a][u][a+calls][tool][a][u][a]
                                         ▲
                              preferred cut lands here, unsafe

  safeSplitIndex walks left past the tool results and their call

  after:   [sys][u: marker + summary][a: "Understood"][ ...last 6 kept... ]
```

---

## 12. Cheat sheet

| Fact | Value |
| --- | --- |
| Runtime dependencies | 12 |
| Tools | 7 (`read`, `ls`, `glob`, `grep`, `edit`, `write`, `bash`) |
| Permission levels | `read-only`, `mutating`, `dangerous` |
| Tests | 153 across 6 files |
| Max agent steps per turn | 25 |
| Tool output cap | 30,000 characters |
| Default bash timeout | 120,000 ms, SIGKILL on expiry |
| Read default limit | 2,000 lines |
| Glob result cap | 300, newest-modified first |
| Grep match cap | 200 |
| Assumed context window | 128,000 tokens |
| Compaction warning at | 80 percent |
| Messages kept on compact | last 6, adjusted to a safe boundary |
| Token estimate | characters divided by 4 |
| Themes | Carbon (default), Paper, Nord, Ember |
| Auth file mode | 0600 |
| Config root | `~/.papercode/`, override with `PAPERCODE_HOME` |
| Kitty push and pop | `\x1b[>1u` and `\x1b[<u` |
| Node requirement | 20 or newer |

**Commands.** `/new` `/sessions` `/models` `/connect` `/disconnect` `/skills`
`/theme` `/compact` `/prompt` `/copy` `/help` `/exit`

**Keys.** Enter send, Shift+Enter or Ctrl+J newline, Tab toggle mode, Esc clear
or interrupt, Ctrl+Y copy, Ctrl+T thinking blocks, `@` files, `/` commands,
arrows history and lists.

**Three things to say if you only get one minute.** The agent core does not know
what a terminal is, which is why the whole stack is testable over real HTTP.
Every abort path answers every pending tool call, because the API rejects a
history with an unanswered call id. PLAN mode is enforced twice, once by
withholding the tools and once at the call site, because models call tools they
were never given.
