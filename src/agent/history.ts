import { randomUUID } from "node:crypto";
import type { SessionEntry } from "../sessions/store.js";
import type { ChatMessage } from "./messages.js";

export type HistoryMeta = { _historyId?: string; _isError?: boolean };

export function historyId(message: ChatMessage): string {
  const meta = message as ChatMessage & HistoryMeta;
  return meta._historyId ??= randomUUID();
}

export function createHistory(entries: SessionEntry[] = []) {
  const originals = new Map<string, ChatMessage>();
  const capture = (messages: ChatMessage[]) => {
    for (const message of messages) {
      const id = historyId(message);
      if (!originals.has(id)) originals.set(id, structuredClone(message));
    }
  };
  for (const entry of entries) {
    if (entry.type === "message") {
      (entry.message as ChatMessage & HistoryMeta)._historyId ??= entry.id;
      capture([entry.message]);
    } else if (entry.type === "compaction") capture(entry.messages);
  }
  return {
    capture,
    has: (id: string) => originals.has(id),
    read(id: string, offset = 0, limit = 8000): string {
      const original = originals.get(id);
      if (!original) throw new Error(`No history entry ${id} in this session.`);
      const text = JSON.stringify(original);
      return JSON.stringify({ id, offset, total: text.length, nextOffset: offset + limit < text.length ? offset + limit : null, text: text.slice(offset, offset + limit) });
    },
  };
}

export type ConversationHistory = ReturnType<typeof createHistory>;
