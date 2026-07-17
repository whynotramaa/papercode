import { z } from "zod";
import { globalSkillsPath, projectSkillsPath } from "./paths.js";
import { readJson, writeJson } from "./jsonFile.js";

export const SkillSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/i, "must be alphanumeric with dashes"),
  description: z.string().default(""),
  prompt: z.string().min(1),
});

export type Skill = z.infer<typeof SkillSchema> & { source: "global" | "project" };


export const RESERVED_NAMES = [
  "new",
  "sessions",
  "models",
  "model",
  "connect",
  "disconnect",
  "login",
  "logout",
  "theme",
  "compact",
  "skills",
  "prompt",
  "copy",
  "help",
  "exit",
  "quit",
] as const;

export function isReserved(name: string): boolean {
  return (RESERVED_NAMES as readonly string[]).includes(name.toLowerCase());
}

export type SkillLoadResult = {
  skills: Skill[];
  
  errors: string[];
};

function loadFile(file: string, source: "global" | "project", errors: string[]): Skill[] {
  const raw = readJson<unknown>(file, null);
  if (raw === null) return [];

  if (!Array.isArray(raw)) {
    errors.push(`${file}: expected a JSON array of skills`);
    return [];
  }

  const out: Skill[] = [];
  for (const [i, entry] of raw.entries()) {
    const parsed = SkillSchema.safeParse(entry);
    if (!parsed.success) {
      const why = parsed.error.issues.map((issue) => issue.message).join("; ");
      errors.push(`${file}[${i}]: ${why}`);
      continue;
    }
    if (isReserved(parsed.data.name)) {
      errors.push(`${file}[${i}]: "${parsed.data.name}" is a built-in command name`);
      continue;
    }
    out.push({ ...parsed.data, source });
  }
  return out;
}

export type SkillScope = "global" | "project";

function scopePath(scope: SkillScope, cwd: string): string {
  return scope === "global" ? globalSkillsPath() : projectSkillsPath(cwd);
}


function readRaw(scope: SkillScope, cwd: string): Record<string, unknown>[] {
  const raw = readJson<unknown>(scopePath(scope, cwd), null);
  if (!Array.isArray(raw)) return [];
  return raw.filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null);
}


export function saveSkill(
  skill: { name: string; description: string; prompt: string },
  scope: SkillScope,
  cwd = process.cwd(),
): void {
  const entries = readRaw(scope, cwd).filter(
    (e) => String(e.name ?? "").toLowerCase() !== skill.name.toLowerCase(),
  );
  entries.push(skill);
  writeJson(scopePath(scope, cwd), entries);
}

export function deleteSkill(name: string, scope: SkillScope, cwd = process.cwd()): boolean {
  const entries = readRaw(scope, cwd);
  const kept = entries.filter((e) => String(e.name ?? "").toLowerCase() !== name.toLowerCase());
  if (kept.length === entries.length) return false;
  writeJson(scopePath(scope, cwd), kept);
  return true;
}

export type ParsedSkills = { skills: z.infer<typeof SkillSchema>[]; errors: string[] };


export function parseSkillsJson(json: string): ParsedSkills {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    return { skills: [], errors: [`Not valid JSON: ${err instanceof Error ? err.message : String(err)}`] };
  }

  const candidates = Array.isArray(parsed) ? parsed : [parsed];
  const skills: z.infer<typeof SkillSchema>[] = [];
  const errors: string[] = [];

  for (const [i, entry] of candidates.entries()) {
    const result = SkillSchema.safeParse(entry);
    if (!result.success) {
      errors.push(`entry ${i + 1}: ${result.error.issues.map((issue) => issue.message).join("; ")}`);
      continue;
    }
    if (isReserved(result.data.name)) {
      errors.push(`entry ${i + 1}: "${result.data.name}" is a built-in command name`);
      continue;
    }
    skills.push(result.data);
  }

  return { skills, errors };
}


export function importSkills(
  skills: z.infer<typeof SkillSchema>[],
  scope: SkillScope,
  cwd = process.cwd(),
): void {
  for (const skill of skills) saveSkill(skill, scope, cwd);
}


export function loadSkills(cwd = process.cwd()): SkillLoadResult {
  const errors: string[] = [];
  const global = loadFile(globalSkillsPath(), "global", errors);
  const project = loadFile(projectSkillsPath(cwd), "project", errors);

  const byName = new Map<string, Skill>();
  for (const skill of global) byName.set(skill.name.toLowerCase(), skill);
  for (const skill of project) byName.set(skill.name.toLowerCase(), skill);

  const skills = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { skills, errors };
}
