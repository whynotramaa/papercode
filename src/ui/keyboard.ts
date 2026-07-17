

const KITTY_PUSH = "\x1b[>1u"; // report alternate keys, which includes modified Enter
const KITTY_POP = "\x1b[<u";


export function supportsKittyKeyboard(): boolean {
  if (process.env.PAPERCODE_NO_KITTY) return false;
  if (!process.stdout.isTTY) return false;

  const term = process.env.TERM ?? "";
  const program = process.env.TERM_PROGRAM ?? "";

  if (process.env.KITTY_WINDOW_ID) return true;
  if (process.env.GHOSTTY_RESOURCES_DIR || program === "ghostty") return true;
  if (process.env.WEZTERM_PANE || program === "WezTerm") return true;
  if (term.includes("kitty") || term.includes("ghostty")) return true;

  return false;
}

let pushed = false;

export function enableKittyKeyboard(): void {
  if (pushed || !supportsKittyKeyboard()) return;
  process.stdout.write(KITTY_PUSH);
  pushed = true;
}


export function disableKittyKeyboard(): void {
  if (!pushed) return;
  process.stdout.write(KITTY_POP);
  pushed = false;
}


export function newlineKeyLabel(): string {
  return supportsKittyKeyboard() ? "Shift+Enter" : "Ctrl+J";
}
