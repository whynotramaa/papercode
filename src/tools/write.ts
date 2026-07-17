import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { resolveInRoot } from "./permissions.js";
import type { Tool } from "./types.js";

const schema = z.object({
  path: z.string().describe("File path, relative to the working directory."),
  content: z.string().describe("Full contents to write. Replaces the file entirely."),
});

export const writeTool: Tool<typeof schema> = {
  name: "write",
  description:
    "Create a new file, or completely replace an existing one. The content you provide becomes the " +
    "entire file — anything you omit is lost. For changing part of an existing file, prefer the edit " +
    "tool. Read an existing file before overwriting it.",
  schema,
  permission: "mutating",
  target: (a) => a.path,
  preview: (a) => `Write ${a.path} (${a.content.split("\n").length} lines)`,

  async run(args, ctx) {
    const resolved = resolveInRoot(ctx.root, args.path);
    if (!resolved.ok) return { content: resolved.reason, isError: true };

    try {
      const existed = await fs
        .stat(resolved.path)
        .then((s) => s.isFile())
        .catch(() => false);

      await fs.mkdir(path.dirname(resolved.path), { recursive: true });
      await fs.writeFile(resolved.path, args.content, "utf8");

      const lines = args.content.split("\n").length;
      return {
        content: `${existed ? "Updated" : "Created"} ${args.path} (${lines} lines).`,
        display: `${existed ? "Updated" : "Created"} ${args.path}`,
      };
    } catch (err) {
      return { content: `Could not write ${args.path}: ${(err as Error).message}`, isError: true };
    }
  },
};
