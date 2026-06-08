import { COMMANDS } from "./commands";
import type { Command } from "./types";

export function getFilteredCommands(query: string, skillCommands: Command[] = []): Command[] {
  const all = [...COMMANDS, ...skillCommands]
  if (query.length === 0) return all
  return all.filter((cmd) => cmd.name.toLowerCase().startsWith(query.toLowerCase()))
}
