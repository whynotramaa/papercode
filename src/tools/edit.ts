import fs from "node:fs/promises";
import { z } from "zod";
import { resolveInRoot } from "./permissions.js";
import type { Tool } from "./types.js";

const editSchema = z.object({
  old_string: z.string().min(1).describe("Exact text to replace, including indentation."),
  new_string: z.string().describe("Text to replace it with."),
  replace_all: z.boolean().optional().describe("Replace every occurrence instead of requiring a unique match."),
});

const schema = z
  .object({
    path: z.string().describe("File path, relative to the working directory."),
    old_string: z.string().min(1).optional().describe("Exact text to replace, including indentation."),
    new_string: z.string().optional().describe("Text to replace it with."),
    replace_all: z.boolean().optional().describe("Replace every occurrence instead of requiring a unique match."),
    edits: z
      .array(editSchema)
      .optional()
      .describe("Several replacements in the same file, applied in order. Use instead of old_string/new_string."),
  })
  .refine((a) => a.edits?.length || (a.old_string !== undefined && a.new_string !== undefined), {
    message: "provide old_string and new_string, or a non-empty edits array",
  });

export type EditArgs = z.infer<typeof schema>;
type Edit = z.infer<typeof editSchema>;

export function countOccurrences(haystack: string, needle: string): number {
  if (needle === "") return 0;
  let count = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    count++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return count;
}

export function editsOf(args: EditArgs): Edit[] {
  if (args.edits?.length) return args.edits;
  return [{ old_string: args.old_string!, new_string: args.new_string!, replace_all: args.replace_all }];
}

function normalizeLine(line: string): string {
  return line
    .replace(/\r$/, "")
    .trimEnd()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/[  -   　]/g, " ");
}

function fuzzyReplace(source: string, edit: Edit): { text: string; hits: number } {
  const lines = source.split("\n");
  const target = edit.old_string.replace(/\n$/, "").split("\n").map(normalizeLine);
  const normalized = lines.map(normalizeLine);
  const starts: number[] = [];
  for (let i = 0; i + target.length <= lines.length; i++) {
    if (target.every((t, j) => normalized[i + j] === t)) starts.push(i);
  }
  if (starts.length !== 1 && !(edit.replace_all && starts.length > 0)) return { text: source, hits: starts.length };
  const replacement = edit.new_string.replace(/\n$/, "").split("\n");
  for (const start of [...starts].reverse()) lines.splice(start, target.length, ...replacement);
  return { text: lines.join("\n"), hits: starts.length };
}

export function applyEdits(source: string, edits: Edit[], label: string): { ok: true; text: string; replaced: number } | { ok: false; error: string } {
  let text = source;
  let replaced = 0;
  for (const [i, edit] of edits.entries()) {
    const which = edits.length > 1 ? `edits[${i}]: ` : "";
    if (edit.old_string === edit.new_string) {
      return { ok: false, error: `${which}old_string and new_string are identical; nothing to do.` };
    }
    const hits = countOccurrences(text, edit.old_string);
    if (hits > 1 && !edit.replace_all) {
      return {
        ok: false,
        error:
          `${which}old_string appears ${hits} times in ${label}. Add surrounding context to identify the one ` +
          `you mean, or pass replace_all: true to change all ${hits}.`,
      };
    }
    if (hits > 0) {
      text = edit.replace_all ? text.split(edit.old_string).join(edit.new_string) : text.replace(edit.old_string, () => edit.new_string);
      replaced += hits;
      continue;
    }
    const fuzzy = fuzzyReplace(text, edit);
    if (fuzzy.hits === 0) {
      return {
        ok: false,
        error:
          `${which}No match for old_string in ${label}. The text must match exactly, including indentation. ` +
          `Re-read the file and copy the target text from the output.`,
      };
    }
    if (fuzzy.text === text) {
      return {
        ok: false,
        error: `${which}old_string matches ${fuzzy.hits} places in ${label} after normalizing whitespace. Add surrounding context.`,
      };
    }
    text = fuzzy.text;
    replaced += fuzzy.hits;
  }
  return { ok: true, text, replaced };
}

export const editTool: Tool<typeof schema> = {
  name: "edit",
  description:
    "Replace text in an existing file. old_string must match the file exactly, including indentation, and " +
    "must appear exactly once. Include surrounding context to make it unique, or set replace_all to change " +
    "every occurrence. To make several changes to one file in one call, pass an edits array instead. " +
    "Read the file first; you cannot match text you have not seen.",
  schema,
  permission: "mutating",
  target: (a) => a.path,
  preview: (a) => `Edit ${a.path}`,

  async run(args, ctx) {
    const resolved = resolveInRoot(ctx.root, args.path);
    if (!resolved.ok) return { content: resolved.reason, isError: true };

    let source: string;
    try {
      source = await fs.readFile(resolved.path, "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return { content: `File not found: ${args.path}. Use the write tool to create it.`, isError: true };
      }
      return { content: `Could not read ${args.path}: ${(err as Error).message}`, isError: true };
    }

    const result = applyEdits(source, editsOf(args), args.path);
    if (!result.ok) return { content: result.error, isError: true };

    try {
      await ctx.beforeWrite?.(resolved.path);
      await fs.writeFile(resolved.path, result.text, "utf8");
    } catch (err) {
      return { content: `Could not write ${args.path}: ${(err as Error).message}`, isError: true };
    }

    const label = result.replaced > 1 ? `${result.replaced} occurrences` : "1 occurrence";
    return { content: `Edited ${args.path} (${label} replaced).`, display: `Edited ${args.path}` };
  },
};
