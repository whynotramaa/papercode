import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "ink-testing-library";
import { Box, Text } from "ink";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { App } from "../app.js";
import { ThemeProvider } from "./themes/context.js";
import { THEMES } from "./themes/themes.js";
import { ScrollArea } from "./components/ScrollArea.js";
import { Editor } from "./components/Editor.js";
import { changedFiles } from "./components/ContextPanel.js";
import { Hints } from "./components/Hints.js";
import { Select } from "./components/Select.js";
import { ToolCall } from "./components/Messages.js";
import { Help } from "./views/Help.js";
import { WORDMARK } from "./brand.js";
import type { ChatMessage } from "../agent/messages.js";
import type OpenAI from "openai";
import * as clients from "../providers/client.js";

vi.mock("../providers/catalog.js", async (original) => ({ ...await original<typeof import("../providers/catalog.js")>(), refreshCatalog: async () => {} }));
const tick = () => new Promise((resolve) => setTimeout(resolve, 45));
const plain = (text = "") => text.replace(/\x1b\[[0-9;]*m/g, "");
let home: string;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "papercode-workspace-"));
  vi.stubEnv("PAPERCODE_HOME", home);
  vi.stubEnv("PAPERCODE_REDUCED_MOTION", "1");
  fs.writeFileSync(path.join(home, "auth.json"), JSON.stringify({ providers: [{ name: "mock", baseURL: "http://localhost:1/v1", apiKey: "k", models: ["model"] }] }));
  fs.writeFileSync(path.join(home, "settings.json"), JSON.stringify({ activeProvider: "mock", activeModel: "model", theme: "signal" }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); fs.rmSync(home, { recursive: true, force: true }); });

async function mount(columns = 120, rows = 36) {
  const app = render(<App initialCwd={home} />);
  resize(app, columns, rows);
  await tick();
  return app;
}
function resize(app: ReturnType<typeof render>, columns: number, rows: number) {
  Object.defineProperty(app.stdout, "columns", { configurable: true, get: () => columns });
  Object.defineProperty(app.stdout, "rows", { configurable: true, get: () => rows });
  app.stdout.emit("resize");
}
function fits(frame: string | undefined, columns: number, rows: number) {
  const lines = plain(frame).split("\n");
  expect(lines.length).toBeLessThanOrEqual(rows - 1);
  expect(Math.max(...lines.map((line) => [...line].length))).toBeLessThanOrEqual(columns);
}

describe("terminal workspace", () => {
  it.each([[40, 18], [60, 18], [80, 24], [110, 26]])("keeps essential palette controls visible at %ix%i", async (columns, rows) => {
    const app = await mount(columns, rows);
    app.stdin.write("/"); await tick();
    const frame = plain(app.lastFrame());
    fits(frame, columns!, rows!);
    expect(frame).toContain("> /new");
    expect(frame).toContain("enter accept");
    expect(frame).toContain("esc dismiss");
    expect(frame.match(/0% context/g)).toHaveLength(1);
    expect(frame).not.toContain("ctrl+c quit");
  });

  it("blocks palette commands during streaming while keeping normal queueing available", async () => {
    let finish!: () => void;
    const waiting = new Promise<void>((resolve) => { finish = resolve; });
    const client = { chat: { completions: { create: async () => ({ async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { content: "Working on the task" }, finish_reason: null }] };
      await waiting;
    } }) } } } as unknown as OpenAI;
    vi.spyOn(clients, "createClient").mockReturnValue(client);
    const app = await mount();
    try {
      app.stdin.write("Start the task"); await tick();
      app.stdin.write("\r"); await tick();
      expect(plain(app.lastFrame())).toContain("QUEUE A MESSAGE");
      app.stdin.write("/new"); await tick();
      app.stdin.write("\r"); await tick();
      expect(plain(app.lastFrame())).toContain("Commands wait until the current response finishes");
      expect(plain(app.lastFrame())).not.toContain("Started a new session");
      expect(plain(app.lastFrame())).toContain("Start the task");
      app.stdin.write("Also check the tests"); await tick();
      app.stdin.write("\r"); await tick();
      expect(plain(app.lastFrame())).toContain("1 queued");
    } finally { finish(); await tick(); }
  });

  it.each([[120, 36], [80, 24], [60, 18], [160, 50]])("fits %ix%i without scrolling the terminal", async (columns, rows) => {
    const app = await mount(columns, rows);
    fits(app.lastFrame(), columns!, rows!);
    expect(plain(app.lastFrame())).toContain("BUILD");
    expect(plain(app.lastFrame())).toContain("context");
    if (columns! >= 110) expect(plain(app.lastFrame())).toContain("Changed files");
    else expect(plain(app.lastFrame())).not.toContain("Changed files");
  });

  it("toggles the context rail and resizes without losing the draft", async () => {
    const app = await mount();
    app.stdin.write("Keep this draft"); await tick();
    app.stdin.write("\x02"); await tick();
    expect(plain(app.lastFrame())).not.toContain("Changed files");
    expect(plain(app.lastFrame())).toContain("Keep this draft");
    app.stdin.write("\x02"); await tick();
    expect(plain(app.lastFrame())).toContain("Changed files");
    resize(app, 80, 24); await tick();
    fits(app.lastFrame(), 80, 24);
    expect(plain(app.lastFrame())).toContain("Keep this draft");
    expect(plain(app.lastFrame())).not.toContain("Changed files");
  });

  it("keeps the command palette inside an 80x24 workspace", async () => {
    const app = await mount(80, 24);
    app.stdin.write("/"); await tick();
    fits(app.lastFrame(), 80, 24);
    expect(plain(app.lastFrame())).toContain("Commands");
    app.stdin.write("\x1b[B"); await tick();
    fits(app.lastFrame(), 80, 24);
    expect(plain(app.lastFrame())).toContain("2/15");
  });

  it("keeps long model IDs inside the status line", async () => {
    fs.writeFileSync(path.join(home, "settings.json"), JSON.stringify({ activeProvider: "mock", activeModel: "very-long-model-".repeat(20), theme: "signal" }));
    const app = await mount(80, 24);
    fits(app.lastFrame(), 80, 24);
    expect(plain(app.lastFrame())).toContain("0% context");
  });
});

describe("layout polish", () => {
  it("fits complete hints on one row and prioritizes confirm and cancel", async () => {
    const app = render(<ThemeProvider name="signal"><Box width={30}><Hints hints={[
      { key: "↑↓", action: "move" }, { key: "Enter", action: "select" },
      { key: "type", action: "search" }, { key: "Esc", action: "cancel" },
    ]} /></Box></ThemeProvider>);
    await tick();
    const out = plain(app.lastFrame());
    expect(out.split("\n")).toHaveLength(1);
    expect(out).toContain("enter select");
    expect(out).toContain("esc cancel");
    expect(out).not.toContain("move");
  });

  it("reserves separate picker columns for the pointer, label, detail and badge", async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ value: i, label: `long-model-name-${i}-suffix`, detail: "large metadata ".repeat(10), badge: i === 0 ? "current" : undefined }));
    const app = render(<ThemeProvider name="signal"><Box width={42}><Select title="A very long picker title that must truncate" items={items} onSelect={() => {}} onCancel={() => {}} /></Box></ThemeProvider>);
    await tick();
    const first = plain(app.lastFrame());
    expect(first.split("\n").every((line) => [...line].length <= 42)).toBe(true);
    expect(first.split("\n").find((line) => line.includes(">"))).toMatch(/> .*current/);
    for (let i = 0; i < 9; i++) { app.stdin.write("\x1b[B"); await tick(); }
    const scrolled = plain(app.lastFrame());
    expect(scrolled.split("\n")).toHaveLength(first.split("\n").length);
    expect(scrolled.split("\n").filter((line) => line.includes(">"))).toHaveLength(1);
  });

  it("keeps long tool names and previews off the result-status column", () => {
    const app = render(<ThemeProvider name="signal"><Box width={40}><ToolCall name="mcp__very_long_server__operation" preview={"preview ".repeat(100)} result="failure" isError /></Box></ThemeProvider>);
    const out = plain(app.lastFrame());
    expect(out.split("\n").every((line) => [...line].length <= 40)).toBe(true);
    expect(out.split("\n")[0]).toContain("✗ failed");
    expect(out.split("\n")[0]).toContain(">");
  });

  it("pages through Help without closing it", async () => {
    const close = vi.fn();
    const app = render(<ThemeProvider name="signal"><Box height={10} width={70}><ScrollArea follow={false}><Help onClose={close} /></ScrollArea></Box></ThemeProvider>);
    await tick();
    app.stdin.write("\x1b[6~"); await tick();
    expect(close).not.toHaveBeenCalled();
    app.stdin.write("\x1b"); await tick();
    expect(close).toHaveBeenCalledOnce();
  });

  it("uses a consistent five-row wordmark with equal-width baselines", () => {
    expect(WORDMARK).toHaveLength(5);
    expect(new Set(WORDMARK.map((line) => line.length)).size).toBe(1);
    expect(WORDMARK[0]!.length).toBeLessThanOrEqual(56);
  });
});

describe("scrollback", () => {
  const lines = Array.from({ length: 35 }, (_, i) => `history-line-${String(i).padStart(2, "0")}`).join("\n");
  const surface = (text: string) => <ThemeProvider name="signal"><Box height={8} width={70}><ScrollArea><Text>{text}</Text></ScrollArea></Box></ThemeProvider>;
  it("follows the latest output and pages through older history", async () => {
    const app = render(surface(lines)); await tick();
    expect(plain(app.lastFrame())).toContain("history-line-34");
    expect(plain(app.lastFrame())).not.toContain("history-line-00");
    app.stdin.write("\x1b[5~"); await tick();
    expect(plain(app.lastFrame())).toContain("Scrollback");
    expect(plain(app.lastFrame())).not.toContain("history-line-34");
    const before = plain(app.lastFrame());
    app.rerender(surface(lines + "\nnew output")); await tick();
    expect(plain(app.lastFrame())).toBe(before);
    for (let i = 0; i < 3; i++) { app.stdin.write("\x1b[6~"); await tick(); }
    expect(plain(app.lastFrame())).toContain("new output");
    expect(plain(app.lastFrame())).not.toContain("Scrollback");
  });
});

describe("composer", () => {
  it("keeps a wrapped caret visible, preserves the entire draft and ignores scroll keys", async () => {
    const submit = vi.fn();
    const app = render(<ThemeProvider name="signal"><Box width={42}><Editor width={42} mode="build" cwd={home} skills={[]} busy={false} onSubmit={submit} onPalette={() => {}} onToggleMode={() => {}} /></Box></ThemeProvider>);
    await tick();
    const draft = "a long draft ".repeat(40) + "CURSOR-END";
    app.stdin.write(draft); await tick();
    expect(plain(app.lastFrame())).toContain("CURSOR-END");
    expect(plain(app.lastFrame()).split("\n").length).toBeLessThan(14);
    app.stdin.write("\x1b[5~"); await tick();
    app.stdin.write("\x01"); await tick();
    app.stdin.write("START "); await tick();
    expect(plain(app.lastFrame())).toContain("START a long draft");
    app.stdin.write("\r"); await tick();
    expect(submit).toHaveBeenCalledWith("START " + draft);
  });
});

describe("context panel evidence", () => {
  it("counts only completed file changes and carries compacted paths forward", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "[Earlier conversation, summarized]\n<modified-files>\nprior.ts\n</modified-files>" },
      { role: "assistant", tool_calls: [
        { id: "ok", type: "function", function: { name: "edit", arguments: '{"path":"changed.ts"}' } },
        { id: "pending", type: "function", function: { name: "write", arguments: '{"path":"pending.ts"}' } },
      ] },
      { role: "tool", tool_call_id: "ok", content: "edited" },
    ];
    expect(changedFiles(messages)).toEqual(["prior.ts", "changed.ts"]);
  });
});

function luminance(hex: string) {
  const rgb = hex.match(/[a-f\d]{2}/gi)!.map((n) => parseInt(n, 16) / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
}
it.each(Object.values(THEMES))("$label has readable text and accents against its background", (theme) => {
  for (const color of [theme.text, theme.muted, theme.faint, theme.primary, theme.accent]) {
    const a = luminance(color), b = luminance(theme.background);
    expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
  }
});
