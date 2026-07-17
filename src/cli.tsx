import React from "react";
import { render } from "ink";
import { App } from "./app.js";
import { enableKittyKeyboard, disableKittyKeyboard } from "./ui/keyboard.js";
import { ensureDir, configDir } from "./config/paths.js";

const HELP = `PaperCode — a terminal coding agent for any OpenAI-compatible provider.

Usage
  papercode              Start in the current directory
  papercode --help       Show this message
  papercode --version    Show the version

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

  void waitUntilExit().then(restore);
}

main();
