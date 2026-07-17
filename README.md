# PaperCode

_by @whynotramaa_

A terminal coding agent that works with any OpenAI-compatible provider. Bring your own base URL and API key — OpenAI, OpenRouter, Groq, Together, DeepSeek, or a local Ollama.

```
npm install
npm run build
node dist/cli.js
```

On first run it opens the `/connect` walkthrough: pick a provider, name it, paste a key, choose a model. Nothing else needs configuring.

## What it does

Reads and writes code, runs commands, and searches a repo, with a permission gate in front of anything destructive.

**BUILD / PLAN modes.** Press `Tab` to toggle. PLAN is read-only: the write, edit, and bash tools are withheld from the model entirely, and refused at the call site if it tries anyway. Use it to ask "what would you change?" without risk.

**Tools.** `read`, `ls`, `glob`, `grep` run freely. `write`, `edit`, and `bash` prompt for approval — once, or for the rest of the session. Every path argument is confined to the directory you launched in.

## Commands

| Command | Description |
| --- | --- |
| `/new` | Start a new conversation (alias: `/clear`) |
| `/sessions` | Browse and resume past sessions (alias: `/resume`; `Ctrl+D` deletes) |
| `/models` | Switch the active model (alias: `/model`) |
| `/connect` | Add or update a provider API key (alias: `/login`) |
| `/disconnect` | Remove a configured provider (alias: `/logout`) |
| `/skills` | Create, import, and manage custom slash-command prompts |
| `/theme` | Change the UI theme, with live preview (alias: `/themes`) |
| `/compact` | Summarize earlier context to free room |
| `/prompt` | Where to set a custom system prompt |
| `/copy` | Copy the last response |
| `/help` | Shortcuts and tips |
| `/exit` | Quit (alias: `/quit`) |

Every command is visible in the `/` palette — the list scrolls, with prefix matches ranked above substring matches. Every list in the app (sessions, models, themes, providers, skills) filters live as you type.

## Keyboard

| Key | Action |
| --- | --- |
| `Enter` | Send |
| `Shift+Enter` | Newline — see the note below |
| `Ctrl+J` | Newline (works everywhere) |
| `Tab` | Toggle build / plan |
| `Esc` | Clear the input (or search query), or interrupt a running response |
| `Ctrl+Y` | Copy the last response |
| `Ctrl+T` | Show / hide thinking blocks across the transcript |
| `@` | File mention autocomplete |
| `/` | Command palette |
| `↑` `↓` | Previous messages, or move through a list |

> **On Shift+Enter.** Terminals don't transmit it distinctly. A classic TTY sends the same byte for `Enter` whether or not Shift is held, so this is unimplementable without the [kitty keyboard protocol](https://sw.kovidgoyal.net/kitty/keyboard-protocol/). PaperCode enables that protocol where it's available (Kitty, Ghostty, WezTerm) and falls back to `Ctrl+J` — a genuinely distinct byte — everywhere else. `/help` tells you which one your terminal is getting.

## Themes

Four, switched with `/theme` and previewed live as you move: **Carbon** (dark, default), **Paper** (light), **Nord**, **Ember**. A theme is a set of semantic tokens (`primary`, `muted`, `faint`, `success`…), never raw colors at the call site — so a fifth is a data change, not a grep.

## Skills

Reusable prompts invoked as slash commands. Create them without leaving the app: `/skills` → **New skill** walks through scope, name, description, and prompt; **Import JSON** accepts a pasted skill object or array. Skills live globally at `~/.papercode/skills.json` or per-project at `.papercode/skills.json`, and a project skill overrides a global one of the same name.

```json
[
  {
    "name": "review",
    "description": "Review code for bugs and style issues",
    "prompt": "Review the code I'm about to share. Look for bugs, security issues, and anything that could be simplified. Be direct."
  }
]
```

Then type `/review`. Built-in command names are reserved and rejected with an explanation rather than silently ignored.

## Storage

Everything lives in `~/.papercode/`:

```
auth.json          providers and API keys — written 0600, owner-only
settings.json      active provider/model, theme, custom system prompt
skills.json        global skills
sessions/<id>.json one file per conversation
```

Sessions are plain JSON, written at each turn boundary. Set `PAPERCODE_HOME` to relocate all of it.

> The original brief asked for `localStorage`. A terminal process has no browser storage, so sessions are JSON files on disk instead — inspectable with `cat`, and greppable.

## Custom system prompt

Set `systemPrompt` in `~/.papercode/settings.json`. It is appended to the base prompt and takes priority over it.

## Development

```
npm test          # 153 tests
npm run typecheck
npm run dev       # rebuild on change
```

The suite covers the parts that fail quietly: panel heights (a frame taller than the terminal makes Ink stack duplicate copies of it), prompt state resetting between steps, streamed tool-call reassembly across chunk boundaries, tool-call/result pairing after an interrupt, path-escape rejection, PLAN-mode enforcement, skills precedence, and the config store's behaviour on corrupt files. `src/e2e.test.ts` runs the whole stack — real HTTP, real SSE, real files — against a mock provider.

## Architecture

```
src/
  cli.tsx          entry: arg parsing, terminal setup
  app.tsx          root: view state, the send loop, command routing
  agent/           streaming loop, compaction, system prompt
  tools/           read write edit ls glob grep bash + permission gate
  providers/       OpenAI-compatible client, model discovery
  config/          auth, settings, skills, paths
  sessions/        JSON session store
  ui/              Ink components, views, themes, markdown
```

The agent loop is provider-agnostic and UI-agnostic: it takes a client, a message list, and a tool executor, and emits typed events. Approval prompting is injected by the UI rather than baked into the tools, which is what lets the tools be tested without a terminal.
