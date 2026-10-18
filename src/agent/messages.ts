import type OpenAI from "openai";

export type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;


export type ToolCall = OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;


export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };

export type AgentEvent =
  | { type: "thinking"; delta: string }
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; name: string; args: unknown }
  | { type: "tool_end"; id: string; name: string; result: string; isError: boolean; display?: string }
  | { type: "usage"; usage: Usage }
  | { type: "retry"; attempt: number; delayMs: number; message: string }
  | { type: "turn_end"; reason: "done" | "aborted" | "max_steps" | "length" };

export type AgentEventHandler = (event: AgentEvent) => void;

export function textOf(message: ChatMessage): string {
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" && part !== null && "text" in part
          ? String((part as { text: unknown }).text)
          : "",
      )
      .join("");
  }
  return "";
}


export function abortedToolResult(id: string): ChatMessage {
  return {
    role: "tool",
    tool_call_id: id,
    content: "Interrupted by the user before this tool finished.",
  };
}
