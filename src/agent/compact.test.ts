import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { compact, compactionBudget, estimateRequestTokens, maskToolResults, prepareContext, serialize, shortenToolOutput } from "./compact.js";
import { createHistory, historyId, type HistoryMeta } from "./history.js";
import { textOf, type ChatMessage } from "./messages.js";
import { toWire } from "./wire.js";
import { GENERIC_COMPAT } from "../providers/compat.js";
import type { ModelInfo } from "../providers/catalog.js";
import { appendCompaction, appendMessages, createSession, loadSession, sessionMessages } from "../sessions/store.js";
import { executeTool } from "../tools/index.js";
import { runTurn } from "./loop.js";

const info = (context = 16000): ModelInfo => ({ context, maxOutput: 4096, reasoning: false, toolCall: true, vision: false });
const signal = () => new AbortController().signal;
const toolPair = (content = "log\n".repeat(2500), isError = false): ChatMessage[] => [
  { role: "assistant", content: null, tool_calls: [{ id: "call", type: "function", function: { name: "bash", arguments: '{"command":"npm test"}' } }] },
  { role: "tool", tool_call_id: "call", content, _isError: isError } as ChatMessage & HistoryMeta,
];
const historyMessages = (): ChatMessage[] => [
  { role: "system", content: "Be helpful." },
  { role: "user", content: "Keep the public API unchanged. " + "Investigation. ".repeat(600) },
  ...toolPair(),
  { role: "assistant", content: "Earlier approach failed. ".repeat(200) },
  { role: "user", content: "Continue the fix and run the tests." },
];
function summaryResponse(id: string, summary = "Working on the fix.") {
  return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ summary, state: {
    request: { text: "Fix and test", sources: [id] },
    constraints: [{ text: "Keep the public API unchanged.", sources: [id] }],
    unfinished: [{ text: "Finish the fix", sources: [id] }],
    failedApproaches: [], verification: [],
  } }) } }] };
}
function clientWith(create: ReturnType<typeof vi.fn>) {
  return { chat: { completions: { create } } } as unknown as OpenAI;
}

let temp: string | undefined;
afterEach(() => {
  vi.unstubAllEnvs();
  if (temp) fs.rmSync(temp, { recursive: true, force: true });
  temp = undefined;
});

describe("compaction budgets and evidence", () => {
  it("scales recent context and response reserves to the model", () => {
    for (const window of [4096, 32000, 128000, 1000000]) {
      const budget = compactionBudget(info(window));
      expect(budget.reserve).toBeLessThan(window * 0.31);
      expect(budget.response).toBeLessThanOrEqual(4096);
      expect(budget.summary + budget.recent + budget.reserve).toBeLessThan(window);
    }
    expect(compactionBudget(info(4096)).recent).toBeLessThan(compactionBudget(info(1000000)).recent);
  });

  it("counts system instructions and tool definitions", () => {
    const messages: ChatMessage[] = [{ role: "system", content: "rules ".repeat(100) }];
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [{ type: "function", function: { name: "x", description: "schema ".repeat(500) } }];
    expect(estimateRequestTokens(messages, tools)).toBeGreaterThan(estimateRequestTokens(messages));
  });

  it("keeps command endings and file locations when shortening results", () => {
    const text = "src/a.ts:1\n" + "noise\n".repeat(2000) + "FAIL: 2 tests failed\nexit code 1";
    for (const name of ["bash", "read", "grep", "mcp__server__run"]) {
      const shortened = shortenToolOutput(text, name);
      expect(shortened).toContain("src/a.ts:1");
      expect(shortened).toContain("FAIL: 2 tests failed");
      expect(shortened.length).toBeLessThan(2100);
    }
  });

  it("masks with arguments, status and a retrievable original, without growing short results", () => {
    const messages = toolPair("FULL ORIGINAL\n".repeat(1000), true);
    const history = createHistory();
    history.capture(messages);
    const masked = maskToolResults(messages, 0);
    expect(masked.saved).toBeGreaterThan(0);
    expect(textOf(masked.messages[1]!)).toContain("status=error");
    expect(textOf(masked.messages[1]!)).toContain("npm test");
    expect(textOf(masked.messages[1]!)).toContain(historyId(messages[1]!));
    history.capture(masked.messages);
    expect(history.read(historyId(messages[1]!))).toContain("FULL ORIGINAL");
    expect(maskToolResults(toolPair("ok"), 0).saved).toBe(0);
    expect(maskToolResults(masked.messages, 0).saved).toBe(0);
  });

  it("includes source references and the end of command failures in the summarizer input", () => {
    const messages = toolPair("start\n" + "x".repeat(5000) + "\nERROR final failure", true);
    const transcript = serialize(messages);
    expect(transcript).toContain("ERROR final failure");
    expect(transcript).toContain(`history id=${historyId(messages[1]!)}`);
    expect(transcript).toContain("status=error");
  });

  it("strips history and error metadata before sending any message to a provider", () => {
    const messages = historyMessages();
    createHistory().capture(messages);
    expect(JSON.stringify(toWire(messages, GENERIC_COMPAT, "m"))).not.toMatch(/_historyId|_isError/);
  });
});

describe("structured compaction", () => {
  it("keeps recent messages verbatim and supplies separate task state with source references", async () => {
    const messages = historyMessages();
    const id = historyId(messages[1]!);
    const create = vi.fn(async () => summaryResponse(id));
    const result = await compact({ client: clientWith(create), model: "m", messages, keepTokens: 100, info: info() });
    expect(result.summarized).toBeGreaterThan(0);
    expect(result.messages.at(-1)).toBe(messages.at(-1));
    expect(result.summary).toContain("<task-state>");
    expect(result.summary).toContain(id);
    expect(estimateRequestTokens(result.messages)).toBeLessThan(estimateRequestTokens(messages));
    const request = create.mock.calls[0] as unknown as [OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming];
    expect(request[0].max_tokens).toBe(compactionBudget(info()).summary);
  });

  it("updates prior task state on another compaction and carries file lists forward", async () => {
    const messages = historyMessages();
    const history = createHistory();
    const id = historyId(messages[1]!);
    const create = vi.fn(async () => summaryResponse(id));
    const first = await compact({ client: clientWith(create), model: "m", messages, history, keepTokens: 100 });
    first.messages[1]!.content += "\n<modified-files>\nsrc/existing.ts\n</modified-files>";
    const next = [...first.messages, { role: "assistant", content: "More investigation. ".repeat(800) }, { role: "user", content: "Keep going" }] as ChatMessage[];
    const result = await compact({ client: clientWith(create), model: "m", messages: next, history, keepTokens: 100 });
    expect(result.summary).toContain("src/existing.ts");
    expect(result.summary).toContain(id);
    const call = create.mock.calls.at(-1) as unknown as [{ messages: ChatMessage[] }];
    expect(textOf(call[0].messages[1]!)).toContain("<task-state>");
  });

  it("splits oversized summarizer inputs into bounded requests", async () => {
    const messages: ChatMessage[] = [{ role: "user", content: "long request ".repeat(10000) }, { role: "user", content: "continue" }];
    const id = historyId(messages[0]!);
    const create = vi.fn(async (request: { messages: ChatMessage[]; max_tokens: number }) => {
      expect(estimateRequestTokens(request.messages) + request.max_tokens).toBeLessThan(8000);
      return summaryResponse(id);
    });
    const result = await compact({ client: clientWith(create), model: "m", messages, keepTokens: 10, info: info(8000) });
    expect(create.mock.calls.length).toBeGreaterThan(1);
    expect(result.summarized).toBe(1);
  });

  it.each(["invalid", "unknown source", "truncated"])("keeps the original history on %s output", async (failure) => {
    const messages = historyMessages();
    const history = createHistory();
    history.capture(messages);
    const before = structuredClone(messages);
    const response = summaryResponse(failure === "unknown source" ? "invented" : historyId(messages[1]!));
    if (failure === "invalid") response.choices[0]!.message.content = "not json";
    if (failure === "truncated") response.choices[0]!.finish_reason = "length";
    await expect(prepareContext({ client: clientWith(vi.fn(async () => response)), model: "m", messages, tools: [], history, force: true })).rejects.toThrow(/original history was kept/);
    expect(messages).toEqual(before);
  });

  it("rejects summaries that grow the history", async () => {
    const messages = historyMessages();
    const response = summaryResponse(historyId(messages[1]!), "huge ".repeat(10000));
    const result = await compact({ client: clientWith(vi.fn(async () => response)), model: "m", messages });
    expect(result.summarized).toBe(0);
    expect(result.messages).toBe(messages);
  });

  it("uses cheap masking before a summary and calls persistence before replacement", async () => {
    const messages = historyMessages();
    messages[3]!.content = "output ".repeat(6000);
    messages[4]!.content = "Recent investigation. ".repeat(500);
    const history = createHistory();
    const create = vi.fn();
    const order: string[] = [];
    const changed = await prepareContext({ client: clientWith(create), model: "m", messages, tools: [], history, info: info(),
      beforeCompact: () => { expect(textOf(messages[3]!)).not.toContain("[Archived"); order.push("persist"); },
      onCompact: (result) => { expect(textOf(result.messages[3]!)).toContain("[Archived"); order.push("compacted"); },
    });
    expect(changed).toBe(true);
    expect(create).not.toHaveBeenCalled();
    expect(order).toEqual(["persist", "compacted"]);
  });

  it("uses measured provider usage instead of compacting an overestimated request", async () => {
    const messages = historyMessages();
    const create = vi.fn();
    expect(await prepareContext({ client: clientWith(create), model: "m", messages, tools: [], info: info(8000), tokens: 100 })).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("original history retrieval", () => {
  it("keeps persisted compaction snapshots immutable as the conversation continues", () => {
    temp = fs.mkdtempSync(path.join(os.tmpdir(), "papercode-history-"));
    vi.stubEnv("PAPERCODE_HOME", temp);
    const session = createSession(temp);
    const messages: ChatMessage[] = [{ role: "user", content: "earlier summary" }];
    appendCompaction(session, messages, 1);
    const summaryId = historyId(messages[0]!);
    messages[0]!.content = "changed after save";
    messages.push({ role: "user", content: "next request" });
    appendMessages(session, [messages[1]!]);
    expect(sessionMessages(session).map(textOf)).toEqual(["earlier summary", "next request"]);
    expect(sessionMessages(loadSession(session.id)!).map(textOf)).toEqual(["earlier summary", "next request"]);
    expect(createHistory(loadSession(session.id)!.entries).read(summaryId)).toContain("earlier summary");
  });

  it("survives compaction, save and reload, with pagination and input validation", async () => {
    temp = fs.mkdtempSync(path.join(os.tmpdir(), "papercode-history-"));
    vi.stubEnv("PAPERCODE_HOME", temp);
    const session = createSession(temp);
    const messages = toolPair("original result ".repeat(2000), true);
    appendMessages(session, messages);
    const id = historyId(messages[1]!);
    appendCompaction(session, maskToolResults(messages, 0).messages, 0);
    const loaded = loadSession(session.id)!;
    const history = createHistory(loaded.entries);
    expect(textOf(sessionMessages(loaded)[1]!)).toContain("[Archived");
    const ctx = { root: temp, signal: signal(), readHistory: history.read };
    const read = (rawArgs: string) => executeTool({ name: "history", rawArgs, ctx, mode: "plan", requestApproval: async () => false });
    const first = await read(JSON.stringify({ id, limit: 200 }));
    const page = JSON.parse(first.content);
    expect(page.nextOffset).toBe(200);
    const second = await read(JSON.stringify({ id, offset: 200, limit: 200 }));
    expect(page.text + JSON.parse(second.content).text).toBe(JSON.parse(history.read(id, 0, 400)).text);
    expect(history.read(id)).toContain("original result");
    expect((await read(JSON.stringify({ id: "other-session" }))).isError).toBe(true);
    expect((await read(JSON.stringify({ id, limit: 999999 }))).isError).toBe(true);
    expect((await read(JSON.stringify({ id, offset: -1 }))).isError).toBe(true);
  });
});

describe("agent loop compaction", () => {
  it("checks before the first request and after each completed tool batch", async () => {
    const messages = historyMessages();
    const history = createHistory();
    const id = historyId(messages[1]!);
    const compacted = vi.fn();
    let streamCalls = 0;
    const create = vi.fn(async (request: { stream: boolean; messages: ChatMessage[] }) => {
      if (!request.stream) return summaryResponse(id);
      expect(estimateRequestTokens(request.messages)).toBeLessThan(8000);
      streamCalls++;
      const delta = streamCalls === 1
        ? { tool_calls: [{ index: 0, id: "read", function: { name: "read", arguments: '{"path":"a.ts"}' } }] }
        : { content: "done" };
      return { async *[Symbol.asyncIterator]() { yield { choices: [{ delta, finish_reason: null }] }; } };
    });
    const result = await runTurn({ client: clientWith(create), model: "m", messages, tools: [], signal: signal(), context: { history, info: info(8000), onCompact: compacted },
      executeTool: async () => ({ content: "small result", isError: false }), onEvent: () => {},
    });
    expect(result.reason).toBe("done");
    expect(compacted).toHaveBeenCalledOnce();
    expect(streamCalls).toBe(2);
  });

  it("compacts between tool batches when fresh tool output fills the context", async () => {
    const messages: ChatMessage[] = [{ role: "user", content: "inspect and fix" }];
    const id = historyId(messages[0]!);
    let requests = 0;
    const compacted = vi.fn();
    const create = vi.fn(async (request: { stream: boolean }) => {
      if (!request.stream) return summaryResponse(id);
      requests++;
      const delta = requests < 3
        ? { tool_calls: [{ index: 0, id: `call${requests}`, function: { name: "read", arguments: '{"path":"a.ts"}' } }] }
        : { content: "done" };
      return { async *[Symbol.asyncIterator]() { yield { choices: [{ delta, finish_reason: null }] }; } };
    });
    await runTurn({ client: clientWith(create), model: "m", messages, tools: [], signal: signal(), context: { info: info(8000), onCompact: compacted },
      executeTool: async () => ({ content: "file ".repeat(2000), isError: false }), onEvent: () => {},
    });
    expect(requests).toBe(3);
    expect(compacted).toHaveBeenCalled();
  });

  it("recovers an overflow once without re-running completed tools", async () => {
    const messages: ChatMessage[] = [{ role: "user", content: "Keep the API unchanged. ".repeat(500) }];
    const id = historyId(messages[0]!);
    let requests = 0;
    const execute = vi.fn(async () => ({ content: "command completed", isError: false }));
    const create = vi.fn(async (request: { stream: boolean; max_tokens?: number }) => {
      if (!request.stream) return summaryResponse(id);
      requests++;
      if (requests === 2) throw new OpenAI.APIError(400, { message: "maximum context length exceeded" }, "maximum context length exceeded", new Headers());
      const delta = requests === 1
        ? { tool_calls: [{ index: 0, id: "mutation", function: { name: "bash", arguments: '{"command":"build"}' } }] }
        : { content: "done" };
      return { async *[Symbol.asyncIterator]() { yield { choices: [{ delta, finish_reason: null }] }; } };
    });
    const result = await runTurn({ client: clientWith(create), model: "m", messages, tools: [], signal: signal(), executeTool: execute, onEvent: () => {} });
    expect(result.reason).toBe("done");
    expect(requests).toBe(3);
    expect(execute).toHaveBeenCalledOnce();
  });

  it("stops after a second overflow on the same request", async () => {
    const messages = historyMessages();
    const id = historyId(messages[1]!);
    let requests = 0;
    const create = vi.fn(async (request: { stream: boolean }) => {
      if (!request.stream) return summaryResponse(id);
      requests++;
      throw new OpenAI.APIError(400, { message: "maximum context length exceeded" }, "maximum context length exceeded", new Headers());
    });
    await expect(runTurn({ client: clientWith(create), model: "m", messages, tools: [], signal: signal(), executeTool: async () => ({ content: "", isError: false }), onEvent: () => {} })).rejects.toThrow(/maximum context/);
    expect(requests).toBe(2);
  });

});
