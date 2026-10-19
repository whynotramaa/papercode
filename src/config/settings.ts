import { z } from "zod";
import { settingsPath } from "./paths.js";
import { readJson, writeJson } from "./jsonFile.js";
import { THEME_NAMES, DEFAULT_THEME, migrateTheme } from "../ui/themes/themes.js";

const SettingsSchema = z.object({
  activeProvider: z.string().optional(),
  activeModel: z.string().optional(),
  theme: z.preprocess(migrateTheme, z.enum(THEME_NAMES).catch(DEFAULT_THEME).default(DEFAULT_THEME)),
  
  systemPrompt: z.string().optional(),
  
  showThinking: z.boolean().catch(false).default(false),
  maxSteps: z.number().int().positive().catch(100).default(100),
  hooks: z
    .object({
      preToolUse: z.array(z.object({ matcher: z.string().optional(), command: z.string() })).optional(),
      postToolUse: z.array(z.object({ matcher: z.string().optional(), command: z.string() })).optional(),
    })
    .optional()
    .catch(undefined),
  thinking: z.enum(["off", "low", "medium", "high"]).catch("off").default("off"),
});

export type Settings = z.infer<typeof SettingsSchema>;

const DEFAULTS: Settings = { theme: DEFAULT_THEME, showThinking: false, maxSteps: 100, thinking: "off" };

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
