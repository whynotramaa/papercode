import fs from "node:fs/promises";
import { z } from "zod";
import { resolveInRoot } from "./permissions.js";
import type { Tool } from "./types.js";

const schema = z.object({
  path: z.string().describe("File path, relative to the working directory."),
  old_string: z.string().min(1).describe("Exact text to replace, including indentation."),
  new_string: z.string().describe("Text to replace it with."),
  replace_all: z.boolean().optional().describe("Replace every occurrence instead of requiring a unique match."),
});

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

export const editTool: Tool<typeof schema> = {
  name: "edit",
  description:
    "Replace exact text in an existing file. old_string must match the file byte for byte, including " +
    "indentation, and must appear exactly once — include surrounding context to make it unique, or set " +
    "replace_all to change every occurrence. Read the file first; you cannot match text you have not seen.",
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

    if (args.old_string === args.new_string) {
      return { content: "old_string and new_string are identical; nothing to do.", isError: true };
    }

    const hits = countOccurrences(source, args.old_string);

    if (hits === 0) {
      // The overwhelmingly common cause is whitespace drift, so say so rather
      // than letting the model retry the same string verbatim.
      return {
        content:
          `No match for old_string in ${args.path}. The text must match exactly, including indentation ` +
          `and line endings. Re-read the file and copy the target text from the output.`,
        isError: true,
      };
    }

    if (hits > 1 && !args.replace_all) {
      return {
        content:
          `old_string appears ${hits} times in ${args.path}. Add surrounding context to identify the one ` +
          `you mean, or pass replace_all: true to change all ${hits}.`,
        isError: true,
      };
    }

    const updated = args.replace_all
      ? source.split(args.old_string).join(args.new_string)
      : source.replace(args.old_string, args.new_string);

    try {
      await fs.writeFile(resolved.path, updated, "utf8");
    } catch (err) {
      return { content: `Could not write ${args.path}: ${(err as Error).message}`, isError: true };
    }

    const label = hits > 1 ? `${hits} occurrences` : "1 occurrence";
    return { content: `Edited ${args.path} (${label} replaced).`, display: `Edited ${args.path}` };
  },
};
