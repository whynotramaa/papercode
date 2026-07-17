import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { z } from "zod";
import { screenBashCommand } from "./permissions.js";
import { truncate, type Tool } from "./types.js";

const schema = z.object({
  command: z.string().min(1).describe("Shell command to run."),
  timeout: z.number().int().min(1000).max(600_000).optional().describe("Timeout in milliseconds. Default 120000."),
});

const DEFAULT_TIMEOUT = 120_000;


function pickShell(): { file: string; args: (cmd: string) => string[] } {
  if (process.platform !== "win32") {
    return { file: "/bin/sh", args: (cmd) => ["-c", cmd] };
  }

  const candidates = [
    process.env.SHELL,
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  ].filter((p): p is string => Boolean(p));

  for (const file of candidates) {
    if (existsSync(file)) return { file, args: (cmd) => ["-c", cmd] };
  }

  return { file: process.env.COMSPEC ?? "cmd.exe", args: (cmd) => ["/d", "/s", "/c", cmd] };
}

export const bashTool: Tool<typeof schema> = {
  name: "bash",
  description:
    "Run a shell command in the working directory. Use it for builds, tests, git, and anything without a " +
    "dedicated tool. Prefer the read, glob, and grep tools over cat, find, and grep — they are faster and " +
    "their output is easier for you to use. Commands run non-interactively: anything that waits for input " +
    "will hang until it times out.",
  schema,
  permission: "dangerous",
  target: (a) => a.command,
  preview: (a) => a.command,

  async run(args, ctx) {
    const screened = screenBashCommand(args.command);
    if (!screened.allow) return { content: screened.reason, isError: true };

    const shell = pickShell();
    const timeout = args.timeout ?? DEFAULT_TIMEOUT;

    return new Promise<{ content: string; isError?: boolean; display?: string }>((resolve) => {
      const child = spawn(shell.file, shell.args(args.command), {
        cwd: ctx.root,
        // Detach stdin: an interactive prompt should hit EOF and exit rather
        // than block forever on a TTY that the agent cannot type into.
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      });

      let stdout = "";
      let stderr = "";
      let finished = false;

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        settle(`Command timed out after ${timeout}ms and was killed.`, true);
      }, timeout);

      const onAbort = () => {
        child.kill("SIGKILL");
        settle("Interrupted by the user.", true);
      };
      ctx.signal.addEventListener("abort", onAbort, { once: true });

      function settle(note: string | null, isError: boolean) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        ctx.signal.removeEventListener("abort", onAbort);

        const body = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
        const text = [note, body].filter(Boolean).join("\n\n");
        resolve({
          content: truncate(text || "(no output)"),
          isError,
          display: isError ? "Failed" : "Done",
        });
      }

      child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
      child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

      child.on("error", (err) => settle(`Could not run the command: ${err.message}`, true));

      child.on("close", (code) => {
        // Non-zero is information for the model (a failing test suite), not a
        // PaperCode error — pass the output through and let it read the exit code.
        settle(code === 0 ? null : `Exit code ${code}.`, code !== 0);
      });
    });
  },
};
