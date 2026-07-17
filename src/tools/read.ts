import fs from "node:fs/promises";
import { z } from "zod";
import { resolveInRoot } from "./permissions.js";
import { truncate, type Tool } from "./types.js";

const schema = z.object({
  path: z.string().describe("File path, relative to the working directory."),
  offset: z.number().int().min(1).optional().describe("1-indexed line to start at."),
  limit: z.number().int().min(1).optional().describe("Maximum lines to read. Defaults to 2000."),
});

const DEFAULT_LIMIT = 2000;
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|exe|dll|so|dylib|woff2?|ttf|mp[34]|mov)$/i;

export const readTool: Tool<typeof schema> = {
  name: "read",
  description:
    "Read a file from the working directory. Output is line-numbered so you can refer to lines precisely. " +
    "Use offset and limit for files too large to read at once. Always read a file before editing it.",
  schema,
  permission: "read-only",
  target: (a) => a.path,
  preview: (a) => `Read ${a.path}`,

  async run(args, ctx) {
    const resolved = resolveInRoot(ctx.root, args.path);
    if (!resolved.ok) return { content: resolved.reason, isError: true };

    if (BINARY_EXT.test(resolved.path)) {
      return { content: `${args.path} looks like a binary file; PaperCode reads text only.`, isError: true };
    }

    let raw: string;
    try {
      const stat = await fs.stat(resolved.path);
      if (stat.isDirectory()) {
        return { content: `${args.path} is a directory. Use the ls tool.`, isError: true };
      }
      raw = await fs.readFile(resolved.path, "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return { content: `File not found: ${args.path}`, isError: true };
      return { content: `Could not read ${args.path}: ${(err as Error).message}`, isError: true };
    }

    if (raw.length === 0) return { content: `${args.path} is empty.`, display: "Empty file" };

    // A NUL byte in the first block is the usual heuristic for "not text".
    if (raw.slice(0, 8000).includes("\u0000")) {
      return { content: `${args.path} appears to be binary; PaperCode reads text only.`, isError: true };
    }

    const lines = raw.split("\n");
    const start = (args.offset ?? 1) - 1;
    const limit = args.limit ?? DEFAULT_LIMIT;

    if (start >= lines.length) {
      return {
        content: `Offset ${args.offset} is past the end of ${args.path} (${lines.length} lines).`,
        isError: true,
      };
    }

    const slice = lines.slice(start, start + limit);
    const width = String(start + slice.length).length;
    const body = slice.map((line, i) => `${String(start + i + 1).padStart(width)}\t${line}`).join("\n");

    const shown = `${start + 1}-${start + slice.length}`;
    const more = start + slice.length < lines.length;
    const footer = more
      ? `\n\n[Showing lines ${shown} of ${lines.length}. Use offset to continue.]`
      : "";

    return {
      content: truncate(body) + footer,
      display: `Read ${slice.length} line${slice.length === 1 ? "" : "s"}`,
    };
  },
};
