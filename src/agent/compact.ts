import type OpenAI from "openai";
import { textOf, type ChatMessage } from "./messages.js";
import { stripReminders } from "./systemPrompt.js";

export const SUMMARY_MARKER = "[Earlier conversation, summarized]";
export const RESERVE_TOKENS = 16_384;
export const KEEP_RECENT_TOKENS = 20_000;
const TOOL_RESULT_CHARS = 2000;
const MASKED = "[Old tool output omitted to save context. Re-run the tool if you need it.]";

const SYSTEM = `You are a context summarization assistant. You read a transcript of a coding
session between a user and an AI coding agent and write a structured summary the agent
will use to continue the work. Do not continue the conversation. Output only the summary.`;

const FORMAT = `Write the summary in exactly this format:

## Goal
What the user is trying to accomplish.

## Constraints & Preferences
Requirements, conventions, and preferences the user stated or implied.

## Progress
### Done
### In Progress
### Blocked

## Key Decisions
Decisions made and why.

## Next Steps
The immediate next actions, in order.

## Critical Context
Exact names, paths, error messages, values, and anything else the agent cannot lose.

Be dense and specific. Omit pleasantries and superseded detail.`;

function hasToolCalls(m: ChatMessage): boolean {
  return m.role === "assistant" && Array.isArray((m as { tool_calls?: unknown[] }).tool_calls);
}

function isToolResult(m: ChatMessage): boolean {
  return m.role === "tool";
}

export function safeSplitIndex(messages: ChatMessage[], preferred: number): number {
  let i = Math.max(0, Math.min(preferred, messages.length));

  while (i > 0) {
    const here = messages[i];
    const before = messages[i - 1];
    const landsOnOrphan = here !== undefined && isToolResult(here);
    const splitsACall = before !== undefined && hasToolCalls(before);
    if (!landsOnOrphan && !splitsACall) break;
    i--;
  }

  return i;
}

function messageTokens(m: ChatMessage): number {
  return estimateTokens([m]);
}

function recentStart(body: ChatMessage[], keepTokens: number): number {
  let kept = 0;
  let i = body.length;
  while (i > 0 && kept < keepTokens) {
    i--;
    kept += messageTokens(body[i]!);
  }
  return i;
}

export function shouldCompact(tokens: number, contextWindow: number): boolean {
  return tokens > contextWindow - RESERVE_TOKENS;
}

export function maskToolResults(
  messages: ChatMessage[],
  keepTokens = KEEP_RECENT_TOKENS,
): { messages: ChatMessage[]; saved: number } {
  const start = recentStart(messages, keepTokens);
  let saved = 0;
  const out = messages.map((m, i) => {
    if (i >= start || m.role !== "tool" || m.content === MASKED) return m;
    const before = messageTokens(m);
    const next = { ...m, content: MASKED };
    saved += before - messageTokens(next);
    return next;
  });
  return { messages: out, saved };
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n…[${text.length - max} more characters]`;
}

export function serialize(messages: ChatMessage[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    const text = textOf(m).trim();
    if (m.role === "user") lines.push(`[User]: ${stripReminders(text)}`);
    else if (m.role === "assistant") {
      if (text) lines.push(`[Assistant]: ${text}`);
      const calls = (m as { tool_calls?: { function: { name: string; arguments: string } }[] }).tool_calls;
      if (calls?.length) {
        lines.push(`[Assistant tool calls]: ${calls.map((c) => `${c.function.name}(${c.function.arguments})`).join("; ")}`);
      }
    } else if (m.role === "tool") lines.push(`[Tool result]: ${clip(text, TOOL_RESULT_CHARS)}`);
  }
  return lines.join("\n\n");
}

function fileLists(messages: ChatMessage[], previous: string): { read: string[]; modified: string[] } {
  const read = new Set<string>();
  const modified = new Set<string>();
  const grab = (tag: string, into: Set<string>) => {
    const block = previous.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? "";
    for (const line of block.split("\n")) if (line.trim()) into.add(line.trim());
  };
  grab("read-files", read);
  grab("modified-files", modified);

  for (const m of messages) {
    const calls = (m as { tool_calls?: { function: { name: string; arguments: string } }[] }).tool_calls ?? [];
    for (const c of calls) {
      let args: { path?: unknown } = {};
      try {
        args = JSON.parse(c.function.arguments || "{}");
      } catch {}
      if (typeof args.path !== "string") continue;
      if (c.function.name === "read") read.add(args.path);
      if (c.function.name === "edit" || c.function.name === "write") modified.add(args.path);
    }
  }
  for (const f of modified) read.delete(f);
  return { read: [...read], modified: [...modified] };
}

function isSummary(m: ChatMessage | undefined): boolean {
  return m?.role === "user" && textOf(m).startsWith(SUMMARY_MARKER);
}

export type CompactResult = {
  messages: ChatMessage[];
  summarized: number;
  summary: string;
};

export async function compact(opts: {
  client: OpenAI;
  model: string;
  messages: ChatMessage[];
  keepTokens?: number;
  focus?: string;
  signal?: AbortSignal;
}): Promise<CompactResult> {
  const { client, model, messages, signal } = opts;

  const system = messages[0]?.role === "system" ? [messages[0]] : [];
  let body = messages.slice(system.length);

  let previous = "";
  if (isSummary(body[0])) {
    previous = textOf(body[0]!).slice(SUMMARY_MARKER.length).trim();
    body = body.slice(body[1]?.role === "assistant" && !hasToolCalls(body[1]) ? 2 : 1);
  }

  let split = safeSplitIndex(body, recentStart(body, opts.keepTokens ?? KEEP_RECENT_TOKENS));
  if (split === 0) split = safeSplitIndex(body, body.length - 1);
  const toSummarize = body.slice(0, split);
  const keep = body.slice(split);

  if (toSummarize.length === 0) return { messages, summarized: 0, summary: "" };

  const prompt = [
    previous ? `<previous-summary>\n${previous}\n</previous-summary>\n\nUpdate the previous summary with the new conversation below.` : "",
    `<conversation>\n${serialize(toSummarize)}\n</conversation>`,
    FORMAT,
    opts.focus?.trim() ? `Focus especially on: ${opts.focus.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await client.chat.completions.create(
    {
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      stream: false,
    },
    signal ? { signal } : {},
  );

  const text = response.choices[0]?.message?.content?.trim() ?? "";
  if (!text) return { messages, summarized: 0, summary: "" };

  const files = fileLists(toSummarize, previous);
  const summary = [
    text.replace(/<(read|modified)-files>[\s\S]*?<\/\1-files>/g, "").trim(),
    files.read.length ? `<read-files>\n${files.read.join("\n")}\n</read-files>` : "",
    files.modified.length ? `<modified-files>\n${files.modified.join("\n")}\n</modified-files>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const ack: ChatMessage[] =
    keep[0]?.role === "assistant" ? [] : [{ role: "assistant", content: "Understood. I have the earlier context." }];

  return {
    messages: [...system, { role: "user", content: `${SUMMARY_MARKER}\n\n${summary}` }, ...ack, ...keep],
    summarized: toSummarize.length,
    summary,
  };
}

export function estimateTokens(messages: ChatMessage[]): number {
  let chars = 0;
  for (const m of messages) {
    const content = (m as { content?: unknown }).content;
    if (typeof content === "string") chars += content.length;
    else if (Array.isArray(content)) {
      for (const part of content as { type?: string; text?: string }[]) chars += part.type === "image_url" ? 4800 : (part.text?.length ?? 0);
    }
    const calls = (m as { tool_calls?: unknown }).tool_calls;
    if (calls) chars += JSON.stringify(calls).length;
  }
  return Math.ceil(chars / 4);
}
