import type OpenAI from "openai";

export type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;


export type ToolCall = OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;


export type AgentEvent =
  | { type: "thinking"; delta: string }
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; name: string; args: unknown }
  | { type: "tool_end"; id: string; name: string; result: string; isError: boolean }
  | { type: "turn_end"; reason: "done" | "aborted" | "max_steps" };

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
