import fs from "node:fs";
import { structuredPatch } from "diff";
import { applyEdits, editsOf, type EditArgs } from "../tools/edit.js";
import { resolveInRoot } from "../tools/permissions.js";

export type DiffLine = { kind: "add" | "del" | "ctx" | "gap"; text: string; line?: number };
export type Diff = { path: string; lines: DiffLine[]; added: number; removed: number };

export function diffLines(path: string, before: string, after: string, context = 2): Diff {
  const patch = structuredPatch(path, path, before, after, "", "", { context });
  const lines: DiffLine[] = [];
  let added = 0;
  let removed = 0;
  for (const [h, hunk] of patch.hunks.entries()) {
    if (h > 0) lines.push({ kind: "gap", text: "⋯" });
    let oldLine = hunk.oldStart;
    let newLine = hunk.newStart;
    for (const raw of hunk.lines) {
      const mark = raw[0];
      const text = raw.slice(1);
      if (mark === "+") {
        lines.push({ kind: "add", text, line: newLine++ });
        added++;
      } else if (mark === "-") {
        lines.push({ kind: "del", text, line: oldLine++ });
        removed++;
      } else if (mark === " ") {
        lines.push({ kind: "ctx", text, line: newLine++ });
        oldLine++;
      }
    }
  }
  return { path, lines, added, removed };
}

function readOr(file: string, fallback: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return fallback;
  }
}

export function proposedDiff(tool: string, args: unknown, root: string): Diff | undefined {
  const a = args as { path?: unknown; content?: unknown };
  if (typeof a.path !== "string") return undefined;
  const resolved = resolveInRoot(root, a.path);
  if (!resolved.ok) return undefined;
  if (tool === "write" && typeof a.content === "string") {
    return diffLines(a.path, readOr(resolved.path, ""), a.content);
  }
  if (tool === "edit") {
    const before = readOr(resolved.path, "");
    const result = applyEdits(before, editsOf(args as EditArgs), a.path);
    return result.ok ? diffLines(a.path, before, result.text) : undefined;
  }
  return undefined;
}
