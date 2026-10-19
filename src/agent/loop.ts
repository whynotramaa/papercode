import type OpenAI from "openai";
import { describeError, isAbort, isContextOverflow, isRetryable, retryDelay, sleep } from "../providers/client.js";
import { GENERIC_COMPAT, thinkingParams, type Compat, type ThinkingLevel } from "../providers/compat.js";
import {
  abortedToolResult,
  type AgentEventHandler,
  type ChatMessage,
  type ToolCall,
  type Usage,
} from "./messages.js";
import { toWire, type AssistantMeta } from "./wire.js";
import { modelInfo } from "../providers/catalog.js";
import { compactionBudget, estimateRequestTokens, estimateTokens, prepareContext, type ContextOptions } from "./compact.js";
import { createHistory, type HistoryMeta } from "./history.js";

export type ToolExecutor = (call: ToolCall) => Promise<{ content: string; isError: boolean; display?: string }>;

export type RunTurnOptions = {
  client: OpenAI;
  model: string;
  messages: ChatMessage[];
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  executeTool: ToolExecutor;
  signal: AbortSignal;
  onEvent: AgentEventHandler;
  maxSteps?: number;
  compat?: Compat;
  thinking?: ThinkingLevel;
  sessionId?: string;
  isParallelSafe?: (name: string) => boolean;
  maxRetries?: number;
  steer?: () => string[];
  context?: ContextOptions;
};

export type TurnReason = "done" | "aborted" | "max_steps" | "length";
export type TurnResult = { reason: TurnReason };

type PartialToolCall = { id: string; name: string; args: string; extra: Record<string, unknown> };

const MAX_RETRIES = 4;

function reasoningDelta(delta: unknown): string {
  if (typeof delta !== "object" || delta === null) return "";
  const d = delta as { reasoning_content?: unknown; reasoning?: unknown };
  if (typeof d.reasoning_content === "string") return d.reasoning_content;
  if (typeof d.reasoning === "string") return d.reasoning;
  return "";
}

export function readUsage(raw: unknown): Usage | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const u = raw as {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
  };
  return {
    input: u.prompt_tokens ?? 0,
    output: u.completion_tokens ?? 0,
    cacheRead: u.prompt_tokens_details?.cached_tokens ?? u.prompt_cache_hit_tokens ?? 0,
    cacheWrite: u.prompt_tokens_details?.cache_write_tokens ?? 0,
  };
}

export async function runTurn(opts: RunTurnOptions): Promise<TurnResult> {
  const { client, model, messages, tools, executeTool, signal, onEvent, sessionId } = opts;
  const maxSteps = opts.maxSteps ?? 25;
  const compat = opts.compat ?? GENERIC_COMPAT;
  const context = { info: modelInfo(compat.kind, model), ...opts.context };
  const history = context.history ?? createHistory();
  let measured: { tokens: number; estimate: number } | undefined;
  const prepare = async (force = false) => {
    history.capture(messages);
    const estimate = estimateRequestTokens(messages, tools);
    const changed = await prepareContext({
      ...context, history, client, model, messages, tools, compat, signal, force,
      tokens: measured ? measured.tokens + Math.max(0, estimate - measured.estimate) : undefined,
    });
    if (changed) measured = undefined;
    return changed;
  };

  const end = (reason: TurnReason): TurnResult => {
    onEvent({ type: "turn_end", reason });
    return { reason };
  };

  for (let step = 0; step < maxSteps; step++) {
    if (signal.aborted) return end("aborted");
    await prepare();
    if (signal.aborted) return end("aborted");

    let text = "";
    let reasoning = "";
    let finish: string | null = null;
    let usage: Usage | undefined;
    const partials = new Map<number, PartialToolCall>();
    let recoveredOverflow = false;
    let inputEstimate = estimateRequestTokens(messages, tools);

    const body = {
      model,
      messages: toWire(messages, compat, model),
      stream: true,
      ...(compat.kind === "openai" ? { max_completion_tokens: compactionBudget(context.info).response } : { max_tokens: compactionBudget(context.info).response }),
      ...(compat.usageInStreaming ? { stream_options: { include_usage: true } } : {}),
      ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
      ...thinkingParams(compat, opts.thinking),
      ...(compat.cacheKey === "prompt_cache_key" && sessionId ? { prompt_cache_key: sessionId } : {}),
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming;
    const headers = compat.cacheKey === "x-session-id" && sessionId ? { "x-session-id": sessionId } : undefined;

    for (let attempt = 0; ; attempt++) {
      let emitted = false;
      try {
        const stream = await client.chat.completions.create(body, { signal, headers });

        for await (const chunk of stream) {
          if (chunk.usage) usage = readUsage(chunk.usage);
          const choice = chunk.choices[0];
          if (!choice) continue;
          if (choice.finish_reason) finish = choice.finish_reason;
          const delta = choice.delta;

          const r = reasoningDelta(delta);
          if (r) {
            emitted = true;
            reasoning += r;
            onEvent({ type: "thinking", delta: r });
          }

          if (typeof delta?.content === "string" && delta.content.length > 0) {
            emitted = true;
            text += delta.content;
            onEvent({ type: "text", delta: delta.content });
          }

          for (const tc of delta?.tool_calls ?? []) {
            emitted = true;
            const { index, id, type: _type, function: fn, ...extra } = tc as typeof tc & Record<string, unknown>;
            const slot = partials.get(index) ?? { id: "", name: "", args: "", extra: {} };
            if (id) slot.id = id;
            if (fn?.name) slot.name += fn.name;
            if (fn?.arguments) slot.args += fn.arguments;
            Object.assign(slot.extra, extra);
            partials.set(index, slot);
          }
        }
        break;
      } catch (err) {
        if (isAbort(err) || signal.aborted) {
          if (text) messages.push({ role: "assistant", content: text });
          return end("aborted");
        }
        if (!emitted && !recoveredOverflow && isContextOverflow(err)) {
          recoveredOverflow = true;
          if (!(await prepare(true))) throw err;
          body.messages = toWire(messages, compat, model);
          inputEstimate = estimateRequestTokens(messages, tools);
          continue;
        }
        if (emitted || attempt >= (opts.maxRetries ?? MAX_RETRIES) || !isRetryable(err)) throw err;
        const delayMs = retryDelay(err, attempt);
        onEvent({ type: "retry", attempt: attempt + 1, delayMs, message: describeError(err) });
        await sleep(delayMs, signal);
        if (signal.aborted) return end("aborted");
      }
    }

    if (usage) onEvent({ type: "usage", usage });

    if (signal.aborted) {
      if (text) messages.push({ role: "assistant", content: text });
      return end("aborted");
    }

    const calls: ToolCall[] = [...partials.entries()]
      .sort(([a], [b]) => a - b)
      .filter(([, p]) => p.name)
      .map(([, p]) => ({
        ...p.extra,
        id: p.id || `call_${Math.random().toString(36).slice(2, 10)}`,
        type: "function" as const,
        function: { name: p.name, arguments: p.args || "{}" },
      }));

    if (calls.length === 0 || finish === "length") {
      messages.push({ role: "assistant", content: text });
      return end(finish === "length" ? "length" : "done");
    }

    const meta: AssistantMeta = { _model: model, ...(reasoning ? { _reasoning: reasoning } : {}) };
    messages.push({ role: "assistant", content: text || null, tool_calls: calls, ...meta } as ChatMessage);
    if (usage?.input) measured = {
      tokens: usage.input + usage.output,
      estimate: inputEstimate + estimateTokens([messages.at(-1)!]),
    };

    const run = async (call: ToolCall) => {
      let parsedArgs: unknown = {};
      try {
        parsedArgs = JSON.parse(call.function.arguments || "{}");
      } catch {}
      onEvent({ type: "tool_start", id: call.id, name: call.function.name, args: parsedArgs });
      const result = await executeTool(call);
      onEvent({ type: "tool_end", id: call.id, name: call.function.name, result: result.content, isError: result.isError, display: result.display });
      return result;
    };

    const parallel = opts.isParallelSafe && calls.length > 1 && calls.every((c) => opts.isParallelSafe!(c.function.name));

    if (parallel) {
      const results = await Promise.all(calls.map(run));
      for (const [i, call] of calls.entries()) {
        messages.push({ role: "tool", tool_call_id: call.id, content: results[i]!.content, _isError: results[i]!.isError } as ChatMessage & HistoryMeta);
      }
      if (signal.aborted) return end("aborted");
      for (const text of opts.steer?.() ?? []) messages.push({ role: "user", content: text });
      continue;
    }

    for (const [i, call] of calls.entries()) {
      if (signal.aborted) {
        for (const pending of calls.slice(i)) messages.push(abortedToolResult(pending.id));
        return end("aborted");
      }
      const { content, isError } = await run(call);
      messages.push({ role: "tool", tool_call_id: call.id, content, _isError: isError } as ChatMessage & HistoryMeta);
    }
    for (const text of opts.steer?.() ?? []) messages.push({ role: "user", content: text });
  }

  return end("max_steps");
}
