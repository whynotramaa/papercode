import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";
import chalk from "chalk";
import type { Theme } from "./themes/themes.js";


const cache = new Map<string, Marked>();

function build(theme: Theme): Marked {
  const instance = new Marked();

  instance.use(
    markedTerminal({
      code: chalk.hex(theme.code),
      blockquote: chalk.hex(theme.quote).italic,
      html: chalk.hex(theme.muted),
      heading: chalk.hex(theme.heading).bold,
      firstHeading: chalk.hex(theme.heading).bold.underline,
      hr: chalk.hex(theme.muted),
      listitem: chalk.hex(theme.text),
      list: (body: string) => body,
      table: chalk.hex(theme.text),
      paragraph: chalk.hex(theme.text),
      strong: chalk.hex(theme.text).bold,
      em: chalk.hex(theme.text).italic,
      codespan: chalk.hex(theme.code),
      del: chalk.hex(theme.muted).strikethrough,
      link: chalk.hex(theme.link).underline,
      href: chalk.hex(theme.link).underline,
      // Ink measures wrapping itself; letting marked-terminal reflow too causes
      // double-wrapping and ragged output in narrow terminals.
      reflowText: false,
      tab: 2,
    }) as Parameters<typeof instance.use>[0],
  );

  return instance;
}

export function renderMarkdown(source: string, theme: Theme): string {
  let instance: Marked | undefined = cache.get(theme.label);
  if (!instance) {
    instance = build(theme);
    cache.set(theme.label, instance);
  }

  try {
    const out = instance.parse(source, { async: false }) as string;
    return out.replace(/\n+$/, "");
  } catch {
    // Malformed markdown must never take the UI down — show the raw text.
    return source;
  }
}


export function extractCodeBlocks(source: string): { lang: string; code: string }[] {
  const blocks: { lang: string; code: string }[] = [];
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    blocks.push({ lang: match[1] ?? "", code: match[2] ?? "" });
  }
  return blocks;
}
