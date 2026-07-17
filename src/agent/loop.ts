import type OpenAI from "openai";
import { isAbort } from "../providers/client.js";
import { abortedToolResult, type AgentEventHandler, type ChatMessage, type ToolCall } from "./messages.js";

export type ToolExecutor = (call: ToolCall) => Promise<{ content: string; isError: boolean }>;

export type RunTurnOptions = {
  client: OpenAI;
  model: string;
  
  messages: ChatMessage[];
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  executeTool: ToolExecutor;
  signal: AbortSignal;
  onEvent: AgentEventHandler;
  
  maxSteps?: number;
};

export type TurnResult = { reason: "done" | "aborted" | "max_steps" };


type PartialToolCall = { id: string; name: string; args: string };


function reasoningDelta(delta: unknown): string {
  if (typeof delta !== "object" || delta === null) return "";
  const d = delta as { reasoning_content?: unknown; reasoning?: unknown };
  if (typeof d.reasoning_content === "string") return d.reasoning_content;
  if (typeof d.reasoning === "string") return d.reasoning;
  return "";
}


export async function runTurn(opts: RunTurnOptions): Promise<TurnResult> {
  const { client, model, messages, tools, executeTool, signal, onEvent } = opts;
  const maxSteps = opts.maxSteps ?? 25;

  for (let step = 0; step < maxSteps; step++) {
    if (signal.aborted) {
      onEvent({ type: "turn_end", reason: "aborted" });
      return { reason: "aborted" };
    }

    let text = "";
    const partials = new Map<number, PartialToolCall>();

    try {
      const stream = await client.chat.completions.create(
        {
          model,
          messages,
          stream: true,
          ...(tools.length > 0 ? { tools, tool_choice: "auto" as const } : {}),
        },
        { signal },
      );

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;
        const delta = choice.delta;

        const reasoning = reasoningDelta(delta);
        if (reasoning) onEvent({ type: "thinking", delta: reasoning });

        if (typeof delta?.content === "string" && delta.content.length > 0) {
          text += delta.content;
          onEvent({ type: "text", delta: delta.content });
        }

        // Tool calls stream in fragments keyed by index: the id and name usually
        // arrive once in the first fragment, then arguments accrete character by
        // character across later ones.
        for (const tc of delta?.tool_calls ?? []) {
          const slot = partials.get(tc.index) ?? { id: "", name: "", args: "" };
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.name += tc.function.name;
          if (tc.function?.arguments) slot.args += tc.function.arguments;
          partials.set(tc.index, slot);
        }
      }
    } catch (err) {
      if (isAbort(err) || signal.aborted) {
        if (text) messages.push({ role: "assistant", content: text });
        onEvent({ type: "turn_end", reason: "aborted" });
        return { reason: "aborted" };
      }
      throw err;
    }

    // The stream can drain before an abort takes effect — a fast response, or a
    // provider that flushes everything at once. Without this check the turn
    // reports "done" and proceeds to run tool calls the user just interrupted.
    if (signal.aborted) {
      if (text) messages.push({ role: "assistant", content: text });
      onEvent({ type: "turn_end", reason: "aborted" });
      return { reason: "aborted" };
    }

    const calls: ToolCall[] = [...partials.entries()]
      .sort(([a], [b]) => a - b)
      .filter(([, p]) => p.name)
      .map(([, p]) => ({
        id: p.id || `call_${Math.random().toString(36).slice(2, 10)}`,
        type: "function" as const,
        function: { name: p.name, arguments: p.args || "{}" },
      }));

    if (calls.length === 0) {
      messages.push({ role: "assistant", content: text });
      onEvent({ type: "turn_end", reason: "done" });
      return { reason: "done" };
    }

    messages.push({
      role: "assistant",
      content: text || null,
      tool_calls: calls,
    });

    for (const [i, call] of calls.entries()) {
      if (signal.aborted) {
        // Every remaining call still needs a result message or the next request
        // is rejected for an unanswered tool_call id.
        for (const pending of calls.slice(i)) messages.push(abortedToolResult(pending.id));
        onEvent({ type: "turn_end", reason: "aborted" });
        return { reason: "aborted" };
      }

      let parsedArgs: unknown = {};
      try {
        parsedArgs = JSON.parse(call.function.arguments || "{}");
      } catch {
        // Leave as {} — the tool's schema validation produces the error the
        // model reads and retries against.
      }

      onEvent({ type: "tool_start", id: call.id, name: call.function.name, args: parsedArgs });

      const { content, isError } = await executeTool(call);

      onEvent({ type: "tool_end", id: call.id, name: call.function.name, result: content, isError });
      messages.push({ role: "tool", tool_call_id: call.id, content });
    }
  }

  onEvent({ type: "turn_end", reason: "max_steps" });
  return { reason: "max_steps" };
}
