import type { Skill } from "../config/skills.js";

export type CommandName =
  | "new"
  | "sessions"
  | "models"
  | "connect"
  | "disconnect"
  | "skills"
  | "theme"
  | "compact"
  | "prompt"
  | "copy"
  | "help"
  | "exit";

export type Command = {
  name: CommandName;
  description: string;
  
  aliases?: string[];
};

export const COMMANDS: Command[] = [
  { name: "new", description: "Start a new conversation", aliases: ["clear"] },
  { name: "sessions", description: "Browse and resume past sessions", aliases: ["resume"] },
  { name: "models", description: "Switch the active model", aliases: ["model"] },
  { name: "connect", description: "Add or update an AI provider API key", aliases: ["login"] },
  { name: "disconnect", description: "Remove a configured provider", aliases: ["logout"] },
  { name: "skills", description: "Create and manage custom slash-command prompts" },
  { name: "theme", description: "Change the UI theme", aliases: ["themes"] },
  { name: "compact", description: "Summarize earlier context to free room" },
  { name: "prompt", description: "Edit the custom system prompt" },
  { name: "copy", description: "Copy the last response to the clipboard" },
  { name: "help", description: "Show keyboard shortcuts and tips" },
  { name: "exit", description: "Quit PaperCode", aliases: ["quit"] },
];

export type PaletteEntry =
  | { kind: "command"; name: CommandName; label: string; description: string }
  | { kind: "skill"; label: string; description: string; skill: Skill };


export function resolveCommand(input: string): Command | undefined {
  const name = input.toLowerCase();
  return COMMANDS.find((c) => c.name === name || c.aliases?.includes(name));
}


export function filterPalette(query: string, skills: Skill[]): PaletteEntry[] {
  const q = query.toLowerCase();

  const commandNames = (c: Command) => [c.name, ...(c.aliases ?? [])];

  const commands: PaletteEntry[] = COMMANDS.filter((c) =>
    commandNames(c).some((n) => n.includes(q)),
  ).map((c) => ({
    kind: "command" as const,
    name: c.name,
    label: `/${c.name}`,
    description: c.aliases?.length ? `${c.description}  (also /${c.aliases.join(", /")})` : c.description,
  }));

  const skillEntries: PaletteEntry[] = skills
    .filter((s) => s.name.toLowerCase().includes(q))
    .map((s) => ({
      kind: "skill" as const,
      label: `/${s.name}`,
      description: s.description || "Custom skill",
      skill: s,
    }));

  const all = [...commands, ...skillEntries];
  const isPrefix = (e: PaletteEntry) =>
    e.kind === "skill"
      ? e.skill.name.toLowerCase().startsWith(q)
      : commandNames(COMMANDS.find((c) => c.name === e.name)!).some((n) => n.startsWith(q));

  return [...all.filter(isPrefix), ...all.filter((e) => !isPrefix(e))];
}
