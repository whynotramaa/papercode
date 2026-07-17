import fg from "fast-glob";
import path from "node:path";
import { z } from "zod";
import { resolveInRoot } from "./permissions.js";
import { truncate, type Tool } from "./types.js";

const schema = z.object({
  pattern: z.string().describe('Glob pattern, e.g. "**/*.ts" or "src/**/test_*.py".'),
  path: z.string().optional().describe("Directory to search in. Defaults to the working directory."),
});

export const DEFAULT_IGNORES = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/.venv/**",
  "**/__pycache__/**",
];

const MAX_RESULTS = 300;

export const globTool: Tool<typeof schema> = {
  name: "glob",
  description:
    "Find files by name pattern, returned newest-modified first. Fast on large repositories. Use this " +
    "to locate files when you know roughly what they are called; use grep to search file contents.",
  schema,
  permission: "read-only",
  target: (a) => a.pattern,
  preview: (a) => `Glob ${a.pattern}`,

  async run(args, ctx) {
    const resolved = resolveInRoot(ctx.root, args.path ?? ".");
    if (!resolved.ok) return { content: resolved.reason, isError: true };

    try {
      const matches = await fg(args.pattern, {
        cwd: resolved.path,
        ignore: DEFAULT_IGNORES,
        onlyFiles: true,
        dot: true,
        followSymbolicLinks: false,
        suppressErrors: true,
        stats: true,
      });

      if (matches.length === 0) {
        return { content: `No files match ${args.pattern}.`, display: "No matches" };
      }

      // Newest first: when a model is orienting in an unfamiliar repo, recently
      // touched files are usually the relevant ones.
      const sorted = matches
        .sort((a, b) => (b.stats?.mtimeMs ?? 0) - (a.stats?.mtimeMs ?? 0))
        .map((m) => path.relative(ctx.root, path.join(resolved.path, m.path)).split(path.sep).join("/"));

      const shown = sorted.slice(0, MAX_RESULTS);
      const footer =
        sorted.length > MAX_RESULTS ? `\n\n[${sorted.length - MAX_RESULTS} more matches not shown.]` : "";

      return {
        content: truncate(shown.join("\n") + footer),
        display: `${sorted.length} file${sorted.length === 1 ? "" : "s"}`,
      };
    } catch (err) {
      return { content: `Glob failed: ${(err as Error).message}`, isError: true };
    }
  },
};
