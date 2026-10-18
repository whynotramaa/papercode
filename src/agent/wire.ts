import type { Compat } from "../providers/compat.js";
import type { ChatMessage } from "./messages.js";

export type AssistantMeta = { _model?: string; _reasoning?: string };

const EPHEMERAL = { type: "ephemeral" } as const;

function withCacheControl(m: ChatMessage): ChatMessage {
  const content = (m as { content?: unknown }).content;
  if (typeof content === "string" && content) {
    return { ...m, content: [{ type: "text", text: content, cache_control: EPHEMERAL }] } as unknown as ChatMessage;
  }
  if (Array.isArray(content) && content.length > 0) {
    const parts = [...content];
    parts[parts.length - 1] = { ...parts[parts.length - 1], cache_control: EPHEMERAL };
    return { ...m, content: parts } as ChatMessage;
  }
  return m;
}

export function toWire(messages: ChatMessage[], compat: Compat, model: string): ChatMessage[] {
  const out = messages.map((m): ChatMessage => {
    if (m.role !== "assistant") return m;
    const { _model, _reasoning, ...rest } = m as ChatMessage & AssistantMeta;
    if (!("tool_calls" in rest) || !rest.tool_calls?.length) return rest as ChatMessage;

    const sameModel = _model === undefined || _model === model;
    const calls = sameModel
      ? rest.tool_calls
      : rest.tool_calls.map((c) => {
          const { id, type, function: fn } = c as { id: string; type: "function"; function: { name: string; arguments: string } };
          return { id, type, function: fn };
        });
    const reasoning = compat.requiresReasoningContent
      ? { reasoning_content: sameModel && _reasoning ? _reasoning : "" }
      : {};
    return { ...rest, tool_calls: calls, ...reasoning } as ChatMessage;
  });

  if (!compat.cacheControl) return out;

  if (out[0]?.role === "system") out[0] = withCacheControl(out[0]);
  for (let i = out.length - 1; i > 0; i--) {
    const m = out[i]!;
    if (m.role === "user" || m.role === "tool") {
      out[i] = withCacheControl(m);
      break;
    }
  }
  return out;
}
