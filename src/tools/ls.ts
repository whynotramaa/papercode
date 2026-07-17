import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { resolveInRoot } from "./permissions.js";
import { truncate, type Tool } from "./types.js";

const schema = z.object({
  path: z.string().optional().describe("Directory to list. Defaults to the working directory."),
});

const NOISE = new Set([".git", "node_modules", ".next", "dist", "build", ".venv", "__pycache__", ".DS_Store"]);

export const lsTool: Tool<typeof schema> = {
  name: "ls",
  description:
    "List the contents of a directory. Directories are marked with a trailing slash. Build and vendor " +
    "directories are collapsed to keep output readable. Use glob to search by name across a tree.",
  schema,
  permission: "read-only",
  target: (a) => a.path ?? ".",
  preview: (a) => `List ${a.path ?? "."}`,

  async run(args, ctx) {
    const resolved = resolveInRoot(ctx.root, args.path ?? ".");
    if (!resolved.ok) return { content: resolved.reason, isError: true };

    let entries;
    try {
      entries = await fs.readdir(resolved.path, { withFileTypes: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return { content: `Directory not found: ${args.path ?? "."}`, isError: true };
      if (code === "ENOTDIR") return { content: `${args.path} is a file, not a directory. Use read.`, isError: true };
      return { content: `Could not list ${args.path ?? "."}: ${(err as Error).message}`, isError: true };
    }

    if (entries.length === 0) return { content: `${args.path ?? "."} is empty.`, display: "Empty directory" };

    const rows = entries
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
      .map((e) => {
        const dir = e.isDirectory();
        const collapsed = dir && NOISE.has(e.name);
        return `${e.name}${dir ? "/" : ""}${collapsed ? "  (contents omitted)" : ""}`;
      });

    const rel = path.relative(ctx.root, resolved.path) || ".";
    return {
      content: truncate(`${rel}:\n${rows.join("\n")}`),
      display: `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`,
    };
  },
};
