import { describe, it, expect, vi } from "vitest";
import type OpenAI from "openai";
import { runTurn } from "./loop.js";
import { safeSplitIndex } from "./compact.js";
import type { AgentEvent, ChatMessage, ToolCall } from "./messages.js";


function chunk(delta: Record<string, unknown>): unknown {
  return { choices: [{ index: 0, delta, finish_reason: null }] };
}


function fakeClient(sequences: unknown[][]): { client: OpenAI; calls: () => number } {
  let call = 0;
  const client = {
    chat: {
      completions: {
        create: async () => {
          const seq = sequences[call++] ?? [];
          return {
            async *[Symbol.asyncIterator]() {
              for (const c of seq) yield c;
            },
          };
        },
      },
    },
  } as unknown as OpenAI;
  return { client, calls: () => call };
}

const noTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];

describe("runTurn", () => {
  it("streams text and appends the assistant message", async () => {
    const { client } = fakeClient([[chunk({ content: "Hel" }), chunk({ content: "lo" })]]);
    const messages: ChatMessage[] = [{ role: "user", content: "hi" }];
    const events: AgentEvent[] = [];

    const result = await runTurn({
      client,
      model: "m",
      messages,
      tools: noTools,
      executeTool: async () => ({ content: "", isError: false }),
      signal: new AbortController().signal,
      onEvent: (e) => events.push(e),
    });

    expect(result.reason).toBe("done");
    expect(messages.at(-1)).toEqual({ role: "assistant", content: "Hello" });
    expect(events.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta)).toEqual(["Hel", "lo"]);
  });

  it("reassembles a tool call split across many chunks", async () => {
    // The id and name arrive once; arguments accrete a fragment at a time. This
    // is the shape real providers send and the easiest thing to get wrong.
    const { client } = fakeClient([
      [
        chunk({ tool_calls: [{ index: 0, id: "call_1", function: { name: "read", arguments: "" } }] }),
        chunk({ tool_calls: [{ index: 0, function: { arguments: '{"pa' } }] }),
        chunk({ tool_calls: [{ index: 0, function: { arguments: 'th":"a' } }] }),
        chunk({ tool_calls: [{ index: 0, function: { arguments: '.ts"}' } }] }),
      ],
      [chunk({ content: "done" })],
    ]);

    const executeTool = vi.fn(async (_call: ToolCall) => ({ content: "file contents", isError: false }));
    const messages: ChatMessage[] = [{ role: "user", content: "read a.ts" }];

    await runTurn({
      client,
      model: "m",
      messages,
      tools: noTools,
      executeTool,
      signal: new AbortController().signal,
      onEvent: () => {},
    });

    expect(executeTool).toHaveBeenCalledOnce();
    const call = executeTool.mock.calls[0]![0];
    expect(call.function.name).toBe("read");
    expect(JSON.parse(call.function.arguments)).toEqual({ path: "a.ts" });
  });

  it("keeps parallel tool calls separate by index", async () => {
    const { client } = fakeClient([
      [
        chunk({
          tool_calls: [
            { index: 0, id: "c0", function: { name: "read", arguments: '{"path":' } },
            { index: 1, id: "c1", function: { name: "ls", arguments: "{}" } },
          ],
        }),
        chunk({ tool_calls: [{ index: 0, function: { arguments: '"a.ts"}' } }] }),
      ],
      [chunk({ content: "ok" })],
    ]);

    const seen: string[] = [];
    const messages: ChatMessage[] = [{ role: "user", content: "go" }];

    await runTurn({
      client,
      model: "m",
      messages,
      tools: noTools,
      executeTool: async (c) => {
        seen.push(`${c.function.name}:${c.function.arguments}`);
        return { content: "ok", isError: false };
      },
      signal: new AbortController().signal,
      onEvent: () => {},
    });

    expect(seen).toEqual(['read:{"path":"a.ts"}', "ls:{}"]);
  });

  it("pairs every tool call with a tool result in history", async () => {
    const { client } = fakeClient([
      [chunk({ tool_calls: [{ index: 0, id: "c0", function: { name: "ls", arguments: "{}" } }] })],
      [chunk({ content: "done" })],
    ]);

    const messages: ChatMessage[] = [{ role: "user", content: "list" }];

    await runTurn({
      client,
      model: "m",
      messages,
      tools: noTools,
      executeTool: async () => ({ content: "a.ts", isError: false }),
      signal: new AbortController().signal,
      onEvent: () => {},
    });

    const assistant = messages.find((m) => m.role === "assistant" && "tool_calls" in m) as {
      tool_calls: { id: string }[];
    };
    const resultIds = messages.filter((m) => m.role === "tool").map((m) => (m as { tool_call_id: string }).tool_call_id);
    expect(resultIds).toEqual(assistant.tool_calls.map((c) => c.id));
  });

  it("answers every pending tool call when aborted mid-turn", async () => {
    // Two calls; the executor aborts during the first. Both still need results
    // or the next request is rejected for an unanswered tool_call id.
    const controller = new AbortController();
    const { client } = fakeClient([
      [
        chunk({
          tool_calls: [
            { index: 0, id: "c0", function: { name: "ls", arguments: "{}" } },
            { index: 1, id: "c1", function: { name: "ls", arguments: "{}" } },
          ],
        }),
      ],
    ]);

    const messages: ChatMessage[] = [{ role: "user", content: "go" }];

    const result = await runTurn({
      client,
      model: "m",
      messages,
      tools: noTools,
      executeTool: async () => {
        controller.abort();
        return { content: "partial", isError: false };
      },
      signal: controller.signal,
      onEvent: () => {},
    });

    expect(result.reason).toBe("aborted");

    const assistant = messages.find((m) => m.role === "assistant" && "tool_calls" in m) as {
      tool_calls: { id: string }[];
    };
    const resultIds = new Set(
      messages.filter((m) => m.role === "tool").map((m) => (m as { tool_call_id: string }).tool_call_id),
    );
    for (const call of assistant.tool_calls) {
      expect(resultIds.has(call.id)).toBe(true);
    }
  });

  it("stops at maxSteps when a model loops on tool calls", async () => {
    const looping = Array.from({ length: 10 }, () => [
      chunk({ tool_calls: [{ index: 0, id: "c", function: { name: "ls", arguments: "{}" } }] }),
    ]);
    const { client } = fakeClient(looping);

    const result = await runTurn({
      client,
      model: "m",
      messages: [{ role: "user", content: "go" }],
      tools: noTools,
      executeTool: async () => ({ content: "ok", isError: false }),
      signal: new AbortController().signal,
      onEvent: () => {},
      maxSteps: 3,
    });

    expect(result.reason).toBe("max_steps");
  });

  it("emits reasoning from either provider field", async () => {
    const { client } = fakeClient([
      [chunk({ reasoning_content: "hmm " }), chunk({ reasoning: "and " }), chunk({ content: "answer" })],
    ]);
    const events: AgentEvent[] = [];

    await runTurn({
      client,
      model: "m",
      messages: [{ role: "user", content: "q" }],
      tools: noTools,
      executeTool: async () => ({ content: "", isError: false }),
      signal: new AbortController().signal,
      onEvent: (e) => events.push(e),
    });

    const thinking = events.filter((e) => e.type === "thinking").map((e) => (e as { delta: string }).delta);
    expect(thinking).toEqual(["hmm ", "and "]);
  });
});

describe("safeSplitIndex", () => {
  const assistantWithCalls: ChatMessage = {
    role: "assistant",
    content: null,
    tool_calls: [{ id: "c0", type: "function", function: { name: "ls", arguments: "{}" } }],
  };
  const toolResult: ChatMessage = { role: "tool", tool_call_id: "c0", content: "ok" };

  it("keeps the preferred index when the cut is already safe", () => {
    const msgs: ChatMessage[] = [
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
    ];
    expect(safeSplitIndex(msgs, 2)).toBe(2);
  });

  it("does not cut between an assistant tool call and its result", () => {
    const msgs: ChatMessage[] = [{ role: "user", content: "a" }, assistantWithCalls, toolResult, { role: "assistant", content: "d" }];
    // Cutting at 2 would orphan the tool result from its call.
    expect(safeSplitIndex(msgs, 2)).toBe(1);
  });

  it("walks back past a tool result to before its call", () => {
    const msgs: ChatMessage[] = [{ role: "user", content: "a" }, assistantWithCalls, toolResult];
    expect(safeSplitIndex(msgs, 3)).toBe(3);
    expect(safeSplitIndex(msgs, 2)).toBe(1);
  });

  it("never returns a negative index", () => {
    expect(safeSplitIndex([toolResult], 1)).toBe(1);
    expect(safeSplitIndex([toolResult], 0)).toBe(0);
  });
});
