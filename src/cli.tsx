import React from "react";
import chalk from "chalk";
import { loadSettings } from "./config/settings.js";
import { THEMES, type ThemeName } from "./ui/themes/themes.js";
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

  const write = process.stdout.write.bind(process.stdout);
  let theme = loadSettings().theme;
  const setTheme = (name: ThemeName) => { theme = name; };
  write("\x1b[?1049h\x1b[H");
  if (process.stdout.isTTY) {
    process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
      if (typeof chunk !== "string") return (write as Function)(chunk, ...rest);
      const palette = THEMES[theme];
      // Ink 5 has no background surfaces. Paint each frame, including erased line tails.
      const painted = chalk.bgHex(palette.background).hex(palette.text)(chunk.replace(/\n/g, "\x1b[K\n"));
      return (write as Function)(`\x1b[?2026h${painted}\x1b[?2026l`, ...rest);
    }) as typeof process.stdout.write;
  }
  const { waitUntilExit } = render(<App initialCwd={process.cwd()} onThemeChange={setTheme} />, { exitOnCtrlC: true });

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    process.stdout.write = write;
    disableKittyKeyboard();
    write("\x1b[0m\x1b[?1049l");
  };
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
