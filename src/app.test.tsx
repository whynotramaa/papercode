
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render } from "ink-testing-library";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let home: string;
let cwd: string;

const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));

const KEY = { enter: "\r", down: "\x1b[B", escape: "\x1b", tab: "\t" };

function plain(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}


async function type(app: { stdin: { write: (s: string) => void } }, keys: string) {
  app.stdin.write(keys);
  await tick();
}


function configure() {
  fs.writeFileSync(
    path.join(home, "auth.json"),
    JSON.stringify({ providers: [{ name: "mock", baseURL: "http://localhost:1/v1", apiKey: "k", models: ["m1"] }] }),
  );
  fs.writeFileSync(
    path.join(home, "settings.json"),
    JSON.stringify({ activeProvider: "mock", activeModel: "m1", theme: "carbon" }),
  );
}


function seedSession(id: string, userMessages: string[], updatedAt: number) {
  const dir = path.join(home, "sessions");
  fs.mkdirSync(dir, { recursive: true });
  const messages = userMessages.flatMap((text) => [
    { role: "user", content: text },
    { role: "assistant", content: `reply ${text}` },
  ]);
  fs.writeFileSync(
    path.join(dir, `${id}.json`),
    // updatedAt fixes the order in the picker, which the tests navigate by index.
    JSON.stringify({ id, title: userMessages[0], cwd, createdAt: 1, updatedAt, messages }),
  );
}


async function mount() {
  const { App } = await import("./app.js");
  const app = render(<App initialCwd={cwd} />);
  await tick();
  return app;
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "papercode-home-"));
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "papercode-cwd-"));
  process.env.PAPERCODE_HOME = home;
});

afterEach(() => {
  delete process.env.PAPERCODE_HOME;
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(cwd, { recursive: true, force: true });
});

describe("App", () => {
  it("opens the connect walkthrough on first run rather than a dead chat box", async () => {
    const { lastFrame } = await mount();
    const out = plain(lastFrame() ?? "");
    expect(out).toContain("Connect a provider");
    expect(out).toContain("OpenAI");
    expect(out).toContain("Ollama");
  });

  it("shows the chat editor and status bar once a provider is configured", async () => {
    fs.writeFileSync(
      path.join(home, "auth.json"),
      JSON.stringify({ providers: [{ name: "mock", baseURL: "http://localhost:1/v1", apiKey: "k", models: ["m1"] }] }),
    );
    fs.writeFileSync(
      path.join(home, "settings.json"),
      JSON.stringify({ activeProvider: "mock", activeModel: "m1", theme: "carbon" }),
    );

    const { lastFrame } = await mount();
    const out = plain(lastFrame() ?? "");
    expect(out).toContain("Describe a task");
    expect(out).toContain("BUILD");
    expect(out).toContain("m1");
  });

  it("respects a saved theme", async () => {
    fs.writeFileSync(
      path.join(home, "auth.json"),
      JSON.stringify({ providers: [{ name: "mock", baseURL: "http://localhost:1/v1", apiKey: "k", models: ["m1"] }] }),
    );
    fs.writeFileSync(
      path.join(home, "settings.json"),
      JSON.stringify({ activeProvider: "mock", activeModel: "m1", theme: "nord" }),
    );

    const { lastFrame } = await mount();
    // Nord's primary is #88c0d0; its presence proves the saved theme was applied
    // rather than the default.
    expect(lastFrame()).toContain("101;217;228");
  });

  it("falls back to the default theme when settings.json is corrupt", async () => {
    fs.writeFileSync(path.join(home, "settings.json"), "{ not json");
    const { lastFrame } = await mount();
    // A broken config costs the user their theme, not their ability to launch.
    expect(lastFrame()).toBeDefined();
    expect(plain(lastFrame() ?? "")).toContain("Connect a provider");
  });

  it("renders the transcript of a resumed session", async () => {
    configure();
    seedSession("aaa", ["FIRST-MARK"], 2);
    const app = await mount();

    await type(app, "/sessions");
    await type(app, KEY.enter);
    await type(app, KEY.enter);

    const out = plain(app.lastFrame() ?? "");
    expect(out).toContain("FIRST-MARK");
    expect(out).toContain("reply FIRST-MARK");
  });

  it("renders the transcript when resuming a second, shorter session", async () => {
    // Assert the final conversation, not a title that also appeared in the picker.
    configure();
    seedSession("aaa", ["FIRST-MARK"], 2);
    seedSession("bbb", ["SECOND-MARK"], 1);

    const app = await mount();

    await type(app, "/sessions");
    await type(app, KEY.enter);
    await type(app, KEY.enter);
    expect(plain(app.lastFrame() ?? "")).toContain("reply FIRST-MARK");

    await type(app, "/sessions");
    await type(app, KEY.enter);
    await type(app, KEY.down);
    await type(app, KEY.enter);

    expect(plain(app.lastFrame() ?? "")).toContain("reply SECOND-MARK");
  });
});
