import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { z } from "zod";
import { resolveInRoot } from "./permissions.js";
import { DEFAULT_IGNORES } from "./glob.js";
import { truncate, type Tool } from "./types.js";

const schema = z.object({
  pattern: z.string().describe("Regular expression to search for."),
  path: z.string().optional().describe("File or directory to search. Defaults to the working directory."),
  glob: z.string().optional().describe('Restrict to files matching a glob, e.g. "*.ts".'),
  case_insensitive: z.boolean().optional(),
  output_mode: z
    .enum(["content", "files_with_matches", "count"])
    .optional()
    .describe("content shows matching lines (default), files_with_matches lists paths, count tallies per file."),
});

type Args = z.infer<typeof schema>;

const MAX_MATCHES = 200;


let rgAvailable: boolean | undefined;

function probeRipgrep(): Promise<boolean> {
  if (rgAvailable !== undefined) return Promise.resolve(rgAvailable);
  return new Promise((resolve) => {
    execFile("rg", ["--version"], { timeout: 3000 }, (err) => {
      rgAvailable = !err;
      resolve(rgAvailable);
    });
  });
}

function rgArgs(args: Args): string[] {
  const out = ["--no-heading", "--line-number", "--color", "never", "--max-count", String(MAX_MATCHES)];
  if (args.case_insensitive) out.push("-i");
  if (args.glob) out.push("--glob", args.glob);
  if (args.output_mode === "files_with_matches") out.push("--files-with-matches");
  if (args.output_mode === "count") out.push("--count");
  for (const ig of ["node_modules", ".git", "dist", "build", ".next", "coverage"]) {
    out.push("--glob", `!**/${ig}/**`);
  }
  out.push("--regexp", args.pattern);
  return out;
}

function runRipgrep(args: Args, cwd: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "rg",
      [...rgArgs(args), "."],
      { cwd, signal, maxBuffer: 8 * 1024 * 1024, timeout: 30_000 },
      (err, stdout) => {
        // rg exits 1 for "no matches", which is a normal result, not a failure.
        if (err && (err as { code?: number }).code !== 1) return reject(err);
        resolve(stdout);
      },
    );
  });
}


async function runJsSearch(args: Args, root: string, searchPath: string): Promise<string> {
  let re: RegExp;
  try {
    re = new RegExp(args.pattern, args.case_insensitive ? "i" : "");
  } catch (err) {
    throw new Error(`Invalid regular expression: ${(err as Error).message}`);
  }

  const stat = await fs.stat(searchPath).catch(() => null);
  const files = stat?.isFile()
    ? [searchPath]
    : (
        await fg(args.glob ?? "**/*", {
          cwd: searchPath,
          ignore: DEFAULT_IGNORES,
          onlyFiles: true,
          dot: true,
          followSymbolicLinks: false,
          suppressErrors: true,
        })
      ).map((p) => path.join(searchPath, p));

  const lines: string[] = [];
  const counts = new Map<string, number>();

  for (const file of files) {
    let content: string;
    try {
      content = await fs.readFile(file, "utf8");
    } catch {
      continue; // binary or unreadable
    }
    if (content.includes("\u0000")) continue; // binary

    const rel = path.relative(root, file).split(path.sep).join("/");
    let n = 0;

    for (const [i, line] of content.split("\n").entries()) {
      if (!re.test(line)) continue;
      n++;
      if (lines.length < MAX_MATCHES) lines.push(`${rel}:${i + 1}:${line.trim()}`);
    }
    if (n > 0) counts.set(rel, n);
  }

  if (args.output_mode === "files_with_matches") return [...counts.keys()].join("\n");
  if (args.output_mode === "count") return [...counts].map(([f, n]) => `${f}:${n}`).join("\n");
  return lines.join("\n");
}

export const grepTool: Tool<typeof schema> = {
  name: "grep",
  description:
    "Search file contents by regular expression. Use this to find where something is defined or used. " +
    "output_mode content returns matching lines with file:line prefixes; files_with_matches returns just " +
    "paths, which is cheaper when you only need to know where to look.",
  schema,
  permission: "read-only",
  target: (a) => a.pattern,
  preview: (a) => `Grep ${a.pattern}`,

  async run(args, ctx) {
    const resolved = resolveInRoot(ctx.root, args.path ?? ".");
    if (!resolved.ok) return { content: resolved.reason, isError: true };

    try {
      const useRg = await probeRipgrep();
      const raw = useRg
        ? await runRipgrep(args, resolved.path, ctx.signal)
        : await runJsSearch(args, ctx.root, resolved.path);

      const text = raw.trim();
      if (!text) return { content: `No matches for ${args.pattern}.`, display: "No matches" };

      const count = text.split("\n").length;
      return {
        content: truncate(text),
        display: `${count} match${count === 1 ? "" : "es"}`,
      };
    } catch (err) {
      return { content: `Search failed: ${(err as Error).message}`, isError: true };
    }
  },
};
