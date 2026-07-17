
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runTurn } from "./agent/loop.js";
import { executeTool, toolDefinitions } from "./tools/index.js";
import { createClient } from "./providers/client.js";
import { fetchModels } from "./providers/models.js";
import type { ChatMessage } from "./agent/messages.js";
import type { Provider } from "./config/auth.js";

type Delta = Record<string, unknown>;

let server: http.Server;
let baseURL: string;
let scripted: Delta[][] = [];
let callCount = 0;
let received: { messages: ChatMessage[]; tools?: { function: { name: string } }[] }[] = [];
let root: string;

function sseBody(deltas: Delta[]): string {
  const events = deltas.map(
    (d) => `data: ${JSON.stringify({ id: "1", object: "chat.completion.chunk", choices: [{ index: 0, delta: d, finish_reason: null }] })}\n\n`,
  );
  return events.join("") + "data: [DONE]\n\n";
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c: Buffer) => (body += c.toString()));
    req.on("end", () => {
      // Match the exact path: a suffix check would also serve
      // /v1/nonexistent/models, which the 404 test depends on missing.
      if (req.url === "/v1/models") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ object: "list", data: [{ id: "mock-large" }, { id: "text-embedding-3-small" }] }));
        return;
      }

      if (req.url === "/v1/chat/completions") {
        received.push(JSON.parse(body));
        const deltas = scripted[callCount++] ?? [{ content: "(unscripted)" }];
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
        res.end(sseBody(deltas));
        return;
      }

      res.writeHead(404);
      res.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  scripted = [];
  callCount = 0;
  received = [];
  root = fs.mkdtempSync(path.join(os.tmpdir(), "papercode-e2e-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function provider(): Provider {
  return { name: "mock", baseURL, apiKey: "test-key", models: [] };
}


async function drive(opts: { mode: "build" | "plan"; approve?: boolean; text: string }) {
  const controller = new AbortController();
  const messages: ChatMessage[] = [
    { role: "system", content: "test" },
    { role: "user", content: opts.text },
  ];

  const result = await runTurn({
    client: createClient(provider()),
    model: "mock-large",
    messages,
    tools: toolDefinitions(opts.mode),
    signal: controller.signal,
    executeTool: async (call) => {
      const r = await executeTool({
        name: call.function.name,
        rawArgs: call.function.arguments,
        mode: opts.mode,
        ctx: { root, signal: controller.signal },
        requestApproval: async () => opts.approve ?? true,
      });
      return { content: r.content, isError: Boolean(r.isError) };
    },
    onEvent: () => {},
  });

  return { result, messages, controller };
}

describe("end-to-end against a mock provider", () => {
  it("lists models over real HTTP and filters out embeddings", async () => {
    const result = await fetchModels(provider());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.models).toContain("mock-large");
      expect(result.models).not.toContain("text-embedding-3-small");
    }
  });

  it("reports a clear error when the endpoint has no /v1/models", async () => {
    const result = await fetchModels({ ...provider(), baseURL: `${baseURL}/nonexistent` });
    expect(result.ok).toBe(false);
  });

  it("streams a plain text answer", async () => {
    scripted = [[{ content: "Hello" }, { content: " there" }]];
    const { messages } = await drive({ mode: "build", text: "hi" });
    expect(messages.at(-1)).toEqual({ role: "assistant", content: "Hello there" });
  });

  it("writes a real file through a real tool call", async () => {
    scripted = [
      [
        { tool_calls: [{ index: 0, id: "c1", type: "function", function: { name: "write", arguments: "" } }] },
        { tool_calls: [{ index: 0, function: { arguments: '{"path":"hello.txt",' } }] },
        { tool_calls: [{ index: 0, function: { arguments: '"content":"hi there"}' } }] },
      ],
      [{ content: "Created it." }],
    ];

    const { messages } = await drive({ mode: "build", text: "create hello.txt" });

    expect(fs.readFileSync(path.join(root, "hello.txt"), "utf8")).toBe("hi there");
    expect(messages.at(-1)).toEqual({ role: "assistant", content: "Created it." });

    // The second request must carry the tool result back to the model.
    const second = received[1]!;
    expect(second.messages.some((m) => m.role === "tool")).toBe(true);
  });

  it("does not offer write or bash to the model in plan mode", async () => {
    scripted = [[{ content: "I would edit config.ts." }]];
    await drive({ mode: "plan", text: "change config" });

    const names = (received[0]!.tools ?? []).map((t) => t.function.name);
    expect(names).toContain("read");
    expect(names).not.toContain("write");
    expect(names).not.toContain("bash");
  });

  it("refuses a write in plan mode even if the model calls it anyway", async () => {
    // A model can emit a tool call for a tool it was never offered. The runtime
    // gate, not the tool list, is the actual guarantee.
    scripted = [
      [
        {
          tool_calls: [
            { index: 0, id: "c1", type: "function", function: { name: "write", arguments: '{"path":"x.txt","content":"nope"}' } },
          ],
        },
      ],
      [{ content: "I cannot write in plan mode." }],
    ];

    await drive({ mode: "plan", text: "write x.txt" });

    expect(fs.existsSync(path.join(root, "x.txt"))).toBe(false);
    const toolResult = received[1]!.messages.find((m) => m.role === "tool") as { content: string };
    expect(toolResult.content).toContain("PLAN mode");
  });

  it("does not write when the user denies approval", async () => {
    scripted = [
      [
        {
          tool_calls: [
            { index: 0, id: "c1", type: "function", function: { name: "write", arguments: '{"path":"y.txt","content":"no"}' } },
          ],
        },
      ],
      [{ content: "Understood." }],
    ];

    await drive({ mode: "build", approve: false, text: "write y.txt" });

    expect(fs.existsSync(path.join(root, "y.txt"))).toBe(false);
    const toolResult = received[1]!.messages.find((m) => m.role === "tool") as { content: string };
    expect(toolResult.content).toContain("denied permission");
  });

  it("blocks a path escape and tells the model why", async () => {
    scripted = [
      [
        {
          tool_calls: [
            { index: 0, id: "c1", type: "function", function: { name: "read", arguments: '{"path":"../../../../etc/passwd"}' } },
          ],
        },
      ],
      [{ content: "Cannot read outside the project." }],
    ];

    await drive({ mode: "build", text: "read passwd" });

    const toolResult = received[1]!.messages.find((m) => m.role === "tool") as { content: string };
    expect(toolResult.content).toContain("escapes the working directory");
  });

  it("recovers from a malformed tool call and leaves history sendable", async () => {
    scripted = [
      [{ tool_calls: [{ index: 0, id: "c1", type: "function", function: { name: "read", arguments: "{broken" } }] }],
      [{ content: "Let me try again." }],
    ];

    const { messages } = await drive({ mode: "build", text: "read something" });

    const toolResult = received[1]!.messages.find((m) => m.role === "tool") as { content: string };
    expect(toolResult.content).toContain("not valid JSON");
    expect(messages.at(-1)).toEqual({ role: "assistant", content: "Let me try again." });
  });

  it("round-trips a read of a file written by a previous turn", async () => {
    fs.writeFileSync(path.join(root, "note.md"), "# Title\nbody\n");
    scripted = [
      [{ tool_calls: [{ index: 0, id: "c1", type: "function", function: { name: "read", arguments: '{"path":"note.md"}' } }] }],
      [{ content: "It is a title and a body." }],
    ];

    await drive({ mode: "build", text: "read note.md" });

    const toolResult = received[1]!.messages.find((m) => m.role === "tool") as { content: string };
    // Line-numbered output is what lets the model cite lines precisely.
    expect(toolResult.content).toContain("1\t# Title");
    expect(toolResult.content).toContain("2\tbody");
  });

  it("keeps history valid after an abort mid-stream", async () => {
    scripted = [[{ content: "partial answer here" }]];

    const controller = new AbortController();
    const messages: ChatMessage[] = [{ role: "user", content: "go" }];

    const promise = runTurn({
      client: createClient(provider()),
      model: "mock-large",
      messages,
      tools: [],
      signal: controller.signal,
      executeTool: async () => ({ content: "", isError: false }),
      onEvent: (e) => {
        if (e.type === "text") controller.abort();
      },
    });

    const result = await promise;
    expect(result.reason).toBe("aborted");

    // The next request must still be accepted: no dangling tool calls, and any
    // partial text preserved as a normal assistant message.
    scripted.push([{ content: "second turn works" }]);
    messages.push({ role: "user", content: "again" });

    const second = await runTurn({
      client: createClient(provider()),
      model: "mock-large",
      messages,
      tools: [],
      signal: new AbortController().signal,
      executeTool: async () => ({ content: "", isError: false }),
      onEvent: () => {},
    });

    expect(second.reason).toBe("done");
    expect(messages.at(-1)).toEqual({ role: "assistant", content: "second turn works" });
  });

  it("surfaces a provider error as a readable message", async () => {
    const bad = createClient({ ...provider(), baseURL: "http://127.0.0.1:1/v1" });
    await expect(
      runTurn({
        client: bad,
        model: "mock-large",
        messages: [{ role: "user", content: "hi" }],
        tools: [],
        signal: new AbortController().signal,
        executeTool: async () => ({ content: "", isError: false }),
        onEvent: () => {},
      }),
    ).rejects.toThrow();
  });
});
