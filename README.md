<div align="center">

# PaperCode

**An AI coding assistant that lives entirely in your terminal.**

[![npm version](https://img.shields.io/npm/v/papercode)](https://www.npmjs.com/package/papercode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-fbf0df)](https://bun.sh)

[Installation](#installation) · [Usage](#usage) · [Commands](#commands) · [Custom Skills](#custom-skills) · [Contributing](#contributing)

</div>

---

PaperCode is a terminal UI (TUI) coding assistant powered by large language models. It spins up a local server, connects to the AI provider of your choice, and gives you a full chat interface — right in your terminal. Sessions are persistent, context is managed automatically, and it can read, write, and run code on your behalf.

## Features

- **Multi-provider** — works with Claude, GPT, Gemini, DeepSeek, Qwen, Kimi, and more via BYOK (bring your own key) or the built-in Zen gateway
- **Two modes** — `PLAN` (read-only exploration) and `BUILD` (file edits + shell commands)
- **File mentions** — type `@` to pull any file into context mid-conversation
- **Context compaction** — automatically summarizes history when approaching token limits so long sessions never break
- **Custom skills** — define reusable slash-command prompts globally or per-project
- **Persistent sessions** — all conversations are saved and resumable
- **Command palette** — `/models`, `/theme`, `/sessions`, `/skills`, and more

## Installation

Requires [Bun](https://bun.sh) >= 1.2.0.

```bash
# Install globally
npm install -g papercode

# Or run without installing
npx papercode
```

**Install Bun** (if you don't have it):
```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# Windows
powershell -c "irm bun.sh/install.ps1 | iex"
```

## Usage

```bash
papercode
```

On first launch, PaperCode generates a local machine ID and opens the home screen. From there you can start a new session or resume a previous one.

### Configure your AI provider

Type `/login` inside PaperCode to set up an API key. Supported providers:

| Provider | Env / Key name |
|---|---|
| Anthropic (Claude) | `ANTHROPIC_API_KEY` |
| OpenAI (GPT) | `OPENAI_API_KEY` |
| Google (Gemini) | `GOOGLE_API_KEY` |
| OpenAI-compatible | custom base URL |
| Zen gateway (default) | `OPENCODE_API_KEY` |

Keys are stored locally in `~/.papercode/credentials.json` — never sent anywhere except the provider you configure.

### Switch models

Type `/models` to browse and select from supported models:

| Provider | Models |
|---|---|
| Anthropic | claude-opus-4, claude-sonnet-4, claude-haiku-4 |
| OpenAI | gpt-5.5, gpt-5.5-pro, gpt-5.4, gpt-5.4-mini |
| Google | gemini-3.5-flash, gemini-3.1-pro |
| DeepSeek / Qwen / Kimi | deepseek-v4-flash, qwen3.7-max, kimi-k2 |

## Commands

Type `/` at any time to open the command palette.

| Command | Description |
|---|---|
| `/new` | Start a new conversation |
| `/sessions` | Browse and resume past sessions |
| `/models` | Switch the active model |
| `/login` | Add or update an AI provider API key |
| `/logout` | Remove a configured provider |
| `/skills` | Manage custom slash-command prompts |
| `/theme` | Change the UI theme |
| `/compact` | Manually compact conversation context |
| `/help` | Show keyboard shortcuts and tips |
| `/exit` | Quit PaperCode |

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Enter` | Send message |
| `Shift+Enter` | Insert a newline |
| `Tab` | Toggle BUILD / PLAN mode |
| `Esc` | Interrupt a running response |
| `@` | Open file mention autocomplete |
| `/` | Open command palette |
| `d` | Delete the current session (from session list) |

## Modes

PaperCode operates in two modes you can toggle with `Tab`:

**PLAN mode** — read-only. The AI can explore your codebase (`read_file`, `grep`, `glob`, `list_directory`) but cannot make changes. Use it for analysis, code review, and planning.

**BUILD mode** — full access. Adds `write_file`, `edit_file`, and `bash` on top of the PLAN tools. Use it to write code, run commands, and apply edits.

The current mode is shown in the status bar at the bottom of the screen.

## Custom Skills

Skills are reusable prompt templates you can invoke as slash commands. Create a JSON file at either location:

- **Global** (all projects): `~/.papercode/skills.json`
- **Per-project**: `.papercode/skills.json`

```json
[
  {
    "name": "review",
    "description": "Review code for bugs and style issues",
    "prompt": "Review the code I'm about to share. Look for bugs, security issues, and anything that could be simplified. Be direct."
  },
  {
    "name": "docstring",
    "description": "Write a docstring for a function",
    "prompt": "Write a concise docstring for the following function. Include parameters, return value, and a one-line summary."
  }
]
```

Then type `/review` or `/docstring` in any session to invoke them.

Reserved names (built-in commands): `new`, `sessions`, `models`, `login`, `logout`, `theme`, `compact`, `skills`, `help`, `exit`.

## System Prompt

Customize the AI's behavior by creating a system prompt file at `~/.papercode/system_prompt.md`. If it exists, PaperCode uses it instead of the built-in default.

## Contributing

PaperCode is a Bun monorepo. You'll need Bun >= 1.2.0 and a PostgreSQL database (a free [Neon](https://neon.tech) instance works).

### Setup

```bash
git clone https://github.com/whynotramaa/papercode
cd papercode
bun install
```

Create a `.env` file in the root:

```env
DATABASE_URL=postgresql://...
API_URL=http://localhost:3000
```

Generate the Prisma client:

```bash
cd packages/database
bunx prisma generate
bunx prisma db push   # applies schema to your database
cd ../..
```

### Development

```bash
# Terminal 1 — server with hot reload
bun run dev:server

# Terminal 2 — CLI with watch mode
bun run dev:cli
```

### Project structure

```
papercode/
├── packages/
│   ├── cli/        # React TUI (OpenTUI + React Router)
│   ├── server/     # Hono HTTP server + AI streaming (Vercel AI SDK)
│   ├── database/   # Prisma schema + client (PostgreSQL)
│   └── shared/     # Zod schemas, model definitions, constants
├── bin/
│   └── papercode.js   # npm bin entry point
├── scripts/
│   └── build.ts       # Production build script
└── dist/              # Build output (server.js, cli.js)
```

### Build for production

```bash
DATABASE_URL=your_neon_url bun run build
```

### Tech stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Terminal UI | [React](https://react.dev) + [OpenTUI](https://github.com/nicholasgasior/opentui) |
| HTTP server | [Hono](https://hono.dev) |
| AI SDK | [Vercel AI SDK](https://sdk.vercel.ai) |
| Database ORM | [Prisma](https://prisma.io) |
| Database | PostgreSQL via [Neon](https://neon.tech) |
| Validation | [Zod](https://zod.dev) |

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
  Built by <a href="https://github.com/whynotramaa">@whynotramaa</a>
</div>
