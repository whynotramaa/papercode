import type OpenAI from "openai";
import type { ChatMessage } from "./messages.js";

const SUMMARY_MARKER = "[Earlier conversation, summarized]";

const SUMMARY_PROMPT = `Summarize the conversation so far for your own future reference.

Capture:
- What the user is trying to accomplish, in their words where possible.
- Files read or modified, with paths, and what changed in each.
- Decisions made and constraints stated, including ones you inferred.
- Anything in progress and what the immediate next step is.

Omit pleasantries and superseded detail. Write dense prose, not bullets for their
own sake. This summary replaces the messages it covers — anything you leave out is
lost.`;


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

export type CompactResult = {
  messages: ChatMessage[];
  summarized: number;
  summary: string;
};


export async function compact(opts: {
  client: OpenAI;
  model: string;
  messages: ChatMessage[];
  keepRecent?: number;
  signal?: AbortSignal;
}): Promise<CompactResult> {
  const { client, model, messages, signal } = opts;
  const keepRecent = opts.keepRecent ?? 6;

  const system = messages[0]?.role === "system" ? [messages[0]] : [];
  const body = messages.slice(system.length);

  const split = safeSplitIndex(body, Math.max(0, body.length - keepRecent));
  const toSummarize = body.slice(0, split);
  const keep = body.slice(split);

  if (toSummarize.length === 0) {
    return { messages, summarized: 0, summary: "" };
  }

  const response = await client.chat.completions.create(
    {
      model,
      messages: [...toSummarize, { role: "user", content: SUMMARY_PROMPT }],
      stream: false,
    },
    signal ? { signal } : {},
  );

  const summary = response.choices[0]?.message?.content?.trim() ?? "";
  if (!summary) {
    // Rather than drop history on a failed summary, leave it untouched.
    return { messages, summarized: 0, summary: "" };
  }

  return {
    messages: [
      ...system,
      { role: "user", content: `${SUMMARY_MARKER}\n\n${summary}` },
      { role: "assistant", content: "Understood — I have the earlier context." },
      ...keep,
    ],
    summarized: toSummarize.length,
    summary,
  };
}


export function estimateTokens(messages: ChatMessage[]): number {
  let chars = 0;
  for (const m of messages) {
    const content = (m as { content?: unknown }).content;
    if (typeof content === "string") chars += content.length;
    else if (Array.isArray(content)) chars += JSON.stringify(content).length;
    const calls = (m as { tool_calls?: unknown }).tool_calls;
    if (calls) chars += JSON.stringify(calls).length;
  }
  return Math.ceil(chars / 4);
}
