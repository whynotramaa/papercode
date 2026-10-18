import React from "react";
import { render } from "ink";
import { App } from "./app.js";
import { enableKittyKeyboard, disableKittyKeyboard } from "./ui/keyboard.js";
import { ensureDir, configDir } from "./config/paths.js";
import { closeMcp } from "./tools/mcp.js";
import { runHeadless } from "./headless.js";

const HELP = `PaperCode — a terminal coding agent for any OpenAI-compatible provider.

Usage
  papercode              Start in the current directory
  papercode --help       Show this message
  papercode --version    Show the version
  papercode -p "task"    Run one task without the UI and print the answer
    --json               Print every agent event as a JSON line instead
    --yes                Let headless runs execute shell and MCP commands

Once running, type / for commands and @ to mention a file.
Configuration lives in ~/.papercode/.`;

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log("papercode 0.1.0");
    return;
  }

  const p = args.findIndex((a) => a === "-p" || a === "--print");
  if (p !== -1) {
    void (async () => {
      let prompt = args[p + 1] && !args[p + 1]!.startsWith("--") ? args[p + 1]! : "";
      if (!process.stdin.isTTY) {
        let piped = "";
        for await (const chunk of process.stdin) piped += chunk;
        prompt = [prompt, piped.trim()].filter(Boolean).join("\n\n");
      }
      if (!prompt) {
        console.error("Give -p a task, or pipe one in.");
        process.exit(1);
      }
      process.exit(await runHeadless(prompt, { json: args.includes("--json"), yes: args.includes("--yes") }));
    })();
    return;
  }

  if (!process.stdin.isTTY) {
    console.error("PaperCode needs an interactive terminal. Run it directly rather than through a pipe.");
    process.exitCode = 1;
    return;
  }

  ensureDir(configDir());
  enableKittyKeyboard();

  // Take the whole screen from the first frame: clear it, wipe scrollback,
  // home the cursor. The app owns the terminal for as long as it runs.
  process.stdout.write("\x1b[2J\x1b[3J\x1b[H");

  if (process.stdout.isTTY) {
    const write = process.stdout.write.bind(process.stdout) as (chunk: unknown, ...rest: unknown[]) => boolean;
    process.stdout.write = ((chunk: unknown, ...rest: unknown[]) =>
      typeof chunk === "string" ? write(`\x1b[?2026h${chunk}\x1b[?2026l`, ...rest) : write(chunk, ...rest)) as typeof process.stdout.write;
  }
  const { waitUntilExit } = render(<App initialCwd={process.cwd()} />, { exitOnCtrlC: true });

  // Restore the terminal's keyboard mode on every exit path. Skipping this on a
  // crash or a signal leaves the user's shell with broken key handling.
  const restore = () => disableKittyKeyboard();
  process.on("exit", restore);
  process.on("SIGINT", () => {
    restore();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    restore();
    process.exit(0);
  });

  void waitUntilExit().then(async () => {
    restore();
    await closeMcp();
    process.exit(0);
  });
}

main();
