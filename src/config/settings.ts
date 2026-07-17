import { z } from "zod";
import { settingsPath } from "./paths.js";
import { readJson, writeJson } from "./jsonFile.js";
import { THEME_NAMES, DEFAULT_THEME } from "../ui/themes/themes.js";

const SettingsSchema = z.object({
  activeProvider: z.string().optional(),
  activeModel: z.string().optional(),
  theme: z.enum(THEME_NAMES).catch(DEFAULT_THEME).default(DEFAULT_THEME),
  
  systemPrompt: z.string().optional(),
  
  showThinking: z.boolean().catch(false).default(false),
});

export type Settings = z.infer<typeof SettingsSchema>;

const DEFAULTS: Settings = { theme: DEFAULT_THEME, showThinking: false };

export function loadSettings(): Settings {
  const parsed = SettingsSchema.safeParse(readJson<unknown>(settingsPath(), DEFAULTS));
  return parsed.success ? parsed.data : DEFAULTS;
}

export function saveSettings(settings: Settings): void {
  writeJson(settingsPath(), settings);
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch };
  saveSettings(next);
  return next;
}
