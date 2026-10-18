import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { configDir } from "../config/paths.js";
import { loadSettings } from "../config/settings.js";
import type { Mode } from "../tools/permissions.js";

const BASE = `You are PaperCode, an AI coding agent running in the user's terminal.

You help with software engineering tasks: reading and understanding code, making
edits, running commands, and answering questions about a codebase.

Guidelines:
- Be concise. Terminal output is cramped; long preambles waste the user's time.
- Use tools to find things out rather than guessing or asking the user for what
  you could read yourself.
- Read a file before editing it. The edit tool requires the exact existing text.
- Prefer the edit tool over write for changes to existing files; write replaces
  the whole file and loses anything you did not reproduce.
- Match the surrounding code's style, naming, and conventions.
- When you finish, state what changed. Do not narrate every step as you go.
- If a tool fails, read the error and adapt. Do not retry the identical call.`;

const MODES = `
Modes:
The user switches between BUILD and PLAN with Tab. Each user message ends with a
<system-reminder> naming the current mode when it changes. In PLAN mode the write,
edit, and bash tools are refused: investigate, explain, and describe the plan, then
tell the user to press Tab for BUILD mode. In BUILD mode every tool is available and
changes may need the user's approval.`;

export function modeReminder(mode: Mode): string {
  return mode === "plan"
    ? "<system-reminder>Current mode: PLAN (read-only). write, edit, and bash are refused.</system-reminder>"
    : "<system-reminder>Current mode: BUILD. All tools are available.</system-reminder>";
}

export function stripReminders(text: string): string {
  return text.replace(/\n*<system-reminder>[\s\S]*?<\/system-reminder>/g, "");
}

const CONTEXT_FILES = ["AGENTS.md", "CLAUDE.md"];

function readContextFile(dir: string): { file: string; text: string } | undefined {
  for (const name of CONTEXT_FILES) {
    const file = path.join(dir, name);
    try {
      return { file, text: fs.readFileSync(file, "utf8").trim() };
    } catch {}
  }
  return undefined;
}

export function projectContext(cwd: string): { file: string; text: string }[] {
  const found: { file: string; text: string }[] = [];
  let dir = path.resolve(cwd);
  for (;;) {
    const hit = readContextFile(dir);
    if (hit) found.unshift(hit);
    if (fs.existsSync(path.join(dir, ".git"))) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const global = readContextFile(configDir());
  if (global) found.unshift(global);
  return found.filter((f) => f.text);
}

export function buildSystemPrompt(cwd = process.cwd()): string {
  const settings = loadSettings();

  const env = [
    `Working directory: ${cwd}`,
    `Platform: ${process.platform}`,
    `OS: ${os.release()}`,
    `Date: ${new Date().toISOString().slice(0, 10)}`,
  ].join("\n");

  const parts = [BASE, MODES, `\nEnvironment:\n${env}`];

  for (const { file, text } of projectContext(cwd)) {
    parts.push(`\nProject instructions from ${file}:\n${text}`);
  }

  if (settings.systemPrompt?.trim()) {
    parts.push(`\nUser instructions (these take priority):\n${settings.systemPrompt.trim()}`);
  }

  return parts.join("\n");
}
