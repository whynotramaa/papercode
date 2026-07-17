import fs from "node:fs";
import { z } from "zod";
import { sessionsDir, sessionPath, ensureDir } from "../config/paths.js";
import { readJson, writeJson } from "../config/jsonFile.js";
import type { ChatMessage } from "../agent/messages.js";

const SessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  cwd: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  provider: z.string().optional(),
  model: z.string().optional(),
  messages: z.array(z.any()),
});

export type Session = {
  id: string;
  title: string;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  provider?: string;
  model?: string;
  messages: ChatMessage[];
};

export function newSessionId(): string {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSession(cwd = process.cwd()): Session {
  const now = Date.now();
  return { id: newSessionId(), title: "New session", cwd, createdAt: now, updatedAt: now, messages: [] };
}


export function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  const content = typeof first?.content === "string" ? first.content : "";
  const line = content.replace(/\s+/g, " ").trim();
  if (!line) return "New session";
  return line.length > 60 ? `${line.slice(0, 57)}...` : line;
}

export function saveSession(session: Session): void {
  ensureDir(sessionsDir());
  const next: Session = { ...session, title: deriveTitle(session.messages) || session.title, updatedAt: Date.now() };
  writeJson(sessionPath(next.id), next);
}

export function loadSession(id: string): Session | undefined {
  const raw = readJson<unknown>(sessionPath(id), null);
  if (raw === null) return undefined;
  const parsed = SessionSchema.safeParse(raw);
  return parsed.success ? (parsed.data as Session) : undefined;
}


export function listSessions(): Session[] {
  const dir = sessionsDir();
  if (!fs.existsSync(dir)) return [];

  const out: Session[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const session = loadSession(file.replace(/\.json$/, ""));
    // An empty session is one the user opened and abandoned; it is noise in the list.
    if (session && session.messages.length > 0) out.push(session);
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteSession(id: string): boolean {
  try {
    fs.unlinkSync(sessionPath(id));
    return true;
  } catch {
    return false;
  }
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
