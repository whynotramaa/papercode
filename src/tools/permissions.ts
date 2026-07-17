import path from "node:path";

export type Mode = "build" | "plan";


export type PermissionLevel = "read-only" | "mutating" | "dangerous";

export type Decision =
  | { allow: true }
  | { allow: false; reason: string };


export class ApprovalStore {
  private granted = new Set<string>();
  
  private blanketEdits = false;

  key(tool: string, target?: string): string {
    return target ? `${tool}::${target}` : tool;
  }

  has(tool: string, level: PermissionLevel, target?: string): boolean {
    if (this.blanketEdits && level === "mutating") return true;
    return this.granted.has(this.key(tool, target));
  }

  grant(tool: string, target?: string): void {
    this.granted.add(this.key(tool, target));
  }

  grantAllEdits(): void {
    this.blanketEdits = true;
  }

  clear(): void {
    this.granted.clear();
    this.blanketEdits = false;
  }
}

const PLAN_BLOCKED =
  "Blocked: PaperCode is in PLAN mode, which is read-only. Do not try this tool or any other " +
  "mutating tool again in this turn. Explain what you would change instead, and tell the user to " +
  "press Tab to switch to BUILD mode if they want it applied.";


export function checkMode(level: PermissionLevel, mode: Mode): Decision {
  if (mode === "plan" && level !== "read-only") {
    return { allow: false, reason: PLAN_BLOCKED };
  }
  return { allow: true };
}


export function resolveInRoot(root: string, input: string): { ok: true; path: string } | { ok: false; reason: string } {
  const resolved = path.resolve(root, input);
  const rel = path.relative(root, resolved);

  const escapes = rel.startsWith("..") || path.isAbsolute(rel);
  if (escapes) {
    return {
      ok: false,
      reason: `Path escapes the working directory: ${input}. PaperCode only operates inside ${root}.`,
    };
  }
  return { ok: true, path: resolved };
}


const BASH_DENY: { pattern: RegExp; why: string }[] = [
  { pattern: /rm\s+(-[a-z]*\s+)*-[a-z]*[rf][a-z]*\s+\/(?:\s|$)/i, why: "recursive delete of /" },
  { pattern: /\bmkfs(\.|\s)/i, why: "filesystem format" },
  { pattern: /\bdd\b[^|]*\bof=\/dev\/(sd|nvme|disk)/i, why: "raw disk write" },
  { pattern: />\s*\/dev\/(sd|nvme|disk)/i, why: "raw disk write" },
  { pattern: /:\(\)\s*\{\s*:\|:&\s*\}\s*;:/, why: "fork bomb" },
];

export function screenBashCommand(command: string): Decision {
  for (const { pattern, why } of BASH_DENY) {
    if (pattern.test(command)) {
      return { allow: false, reason: `Refused (${why}). This command is blocked by PaperCode.` };
    }
  }
  return { allow: true };
}
