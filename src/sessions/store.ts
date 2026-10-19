import fs from "node:fs";
import path from "node:path";
import { sessionsDir, ensureDir } from "../config/paths.js";
import { textOf, type ChatMessage } from "../agent/messages.js";
import { stripReminders } from "../agent/systemPrompt.js";
import { historyId, type HistoryMeta } from "../agent/history.js";

export type SessionEntry =
  | { type: "message"; id: string; parentId: string | null; ts: number; message: ChatMessage }
  | { type: "compaction"; id: string; parentId: string | null; ts: number; messages: ChatMessage[]; summarized: number }
  | { type: "branch"; id: string; ts: number; leafId: string | null }
  | { type: "info"; id: string; ts: number; provider?: string; model?: string };

type Header = { type: "session"; version: 2; id: string; cwd: string; createdAt: number };

export type Session = {
  id: string;
  title: string;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  provider?: string;
  model?: string;
  entries: SessionEntry[];
  leaf: string | null;
};

export function newSessionId(): string {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

function entryId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function filePath(id: string): string {
  return path.join(sessionsDir(), `${id}.jsonl`);
}

function legacyPath(id: string): string {
  return path.join(sessionsDir(), `${id}.json`);
}

export function createSession(cwd = process.cwd()): Session {
  const now = Date.now();
  return { id: newSessionId(), title: "New session", cwd, createdAt: now, updatedAt: now, entries: [], leaf: null };
}

export function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  const content = first ? stripReminders(textOf(first)) : "";
  const line = content.replace(/\s+/g, " ").trim();
  if (!line) return "New session";
  return line.length > 60 ? `${line.slice(0, 57)}...` : line;
}

function append(session: Session, entries: SessionEntry[]): void {
  if (entries.length === 0) return;
  ensureDir(sessionsDir());
  const file = filePath(session.id);
  const lines = entries.map((e) => JSON.stringify(e));
  if (!fs.existsSync(file)) {
    const header: Header = { type: "session", version: 2, id: session.id, cwd: session.cwd, createdAt: session.createdAt };
    lines.unshift(JSON.stringify(header));
  }
  fs.appendFileSync(file, `${lines.join("\n")}\n`);
  for (const e of entries) apply(session, e);
}

function apply(session: Session, e: SessionEntry): void {
  if (e.type === "message") (e.message as ChatMessage & HistoryMeta)._historyId ??= e.id;
  session.entries.push(e);
  session.updatedAt = Math.max(session.updatedAt, e.ts);
  if (e.type === "message" || e.type === "compaction") session.leaf = e.id;
  else if (e.type === "branch") session.leaf = e.leafId;
  else {
    if (e.provider) session.provider = e.provider;
    if (e.model) session.model = e.model;
  }
  if (session.title === "New session" && e.type === "message" && e.message.role === "user") {
    session.title = deriveTitle([e.message]);
  }
}

export function appendMessages(session: Session, messages: ChatMessage[], now = Date.now()): void {
  let parent = session.leaf;
  const entries: SessionEntry[] = messages.map((message) => {
    const id = historyId(message);
    const entry: SessionEntry = { type: "message", id, parentId: parent, ts: now, message };
    parent = id;
    return entry;
  });
  append(session, entries);
}

export function appendCompaction(session: Session, messages: ChatMessage[], summarized: number): void {
  for (const message of messages) historyId(message);
  append(session, [{ type: "compaction", id: entryId(), parentId: session.leaf, ts: Date.now(), messages: structuredClone(messages), summarized }]);
}

export function appendInfo(session: Session, provider?: string, model?: string): void {
  if (provider === session.provider && model === session.model) return;
  if (session.entries.length === 0) {
    session.provider = provider;
    session.model = model;
    return;
  }
  append(session, [{ type: "info", id: entryId(), ts: Date.now(), provider, model }]);
}

export function branchTo(session: Session, leafId: string | null): void {
  append(session, [{ type: "branch", id: entryId(), ts: Date.now(), leafId }]);
}

type TreeEntry = Extract<SessionEntry, { parentId: string | null }>;

export function pathTo(session: Session, leafId: string | null = session.leaf): TreeEntry[] {
  const byId = new Map<string, TreeEntry>();
  for (const e of session.entries) if (e.type === "message" || e.type === "compaction") byId.set(e.id, e);
  const out: TreeEntry[] = [];
  let cursor = leafId ? byId.get(leafId) : undefined;
  while (cursor) {
    out.push(cursor);
    if (cursor.type === "compaction") break;
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return out.reverse();
}

export function sessionMessages(session: Session, leafId: string | null = session.leaf): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const e of pathTo(session, leafId)) {
    if (e.type === "compaction") out.splice(0, out.length, ...e.messages);
    else out.push(e.message);
  }
  return out;
}

export function treeEntries(session: Session): TreeEntry[] {
  return session.entries.filter((e): e is TreeEntry => e.type === "message" || e.type === "compaction");
}

function parse(id: string, text: string): Session | undefined {
  const lines = text.split("\n").filter((l) => l.trim());
  let header: Header | undefined;
  try {
    header = JSON.parse(lines[0] ?? "") as Header;
  } catch {
    return undefined;
  }
  if (header?.type !== "session") return undefined;
  const session: Session = {
    id,
    title: "New session",
    cwd: header.cwd,
    createdAt: header.createdAt,
    updatedAt: header.createdAt,
    entries: [],
    leaf: null,
  };
  for (const line of lines.slice(1)) {
    try {
      apply(session, JSON.parse(line) as SessionEntry);
    } catch {}
  }
  return session;
}

function migrate(id: string): Session | undefined {
  let raw: { title?: string; cwd?: string; createdAt?: number; updatedAt?: number; provider?: string; model?: string; messages?: ChatMessage[] };
  try {
    raw = JSON.parse(fs.readFileSync(legacyPath(id), "utf8"));
  } catch {
    return undefined;
  }
  if (typeof raw?.cwd !== "string" || !Array.isArray(raw.messages)) return undefined;
  const session: Session = {
    id,
    title: "New session",
    cwd: raw.cwd,
    createdAt: raw.createdAt ?? Date.now(),
    updatedAt: raw.createdAt ?? Date.now(),
    provider: raw.provider,
    model: raw.model,
    entries: [],
    leaf: null,
  };
  if (raw.messages.length > 0) appendMessages(session, raw.messages, raw.updatedAt ?? session.createdAt);
  fs.rmSync(legacyPath(id), { force: true });
  return session;
}

export function loadSession(id: string): Session | undefined {
  try {
    return parse(id, fs.readFileSync(filePath(id), "utf8"));
  } catch {
    return migrate(id);
  }
}

export function listSessions(): Session[] {
  const dir = sessionsDir();
  if (!fs.existsSync(dir)) return [];

  const ids = new Set<string>();
  for (const file of fs.readdirSync(dir)) {
    const match = file.match(/^(.+)\.jsonl?$/);
    if (match) ids.add(match[1]!);
  }
  const out: Session[] = [];
  for (const id of ids) {
    const session = loadSession(id);
    if (session && session.entries.length > 0) out.push(session);
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id));
}

export function deleteSession(id: string): boolean {
  let removed = false;
  for (const file of [filePath(id), legacyPath(id)]) {
    try {
      fs.unlinkSync(file);
      removed = true;
    } catch {}
  }
  return removed;
}

export function relativeTime(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}
