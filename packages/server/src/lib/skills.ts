import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { skillsFileSchema, type Skill } from "@papercode/shared"

const GLOBAL_SKILLS_PATH = join(homedir(), ".papercode", "skills.json")

const BUILTIN_NAMES = new Set([
  "new", "sessions", "models", "login", "logout",
  "theme", "compact", "help", "exit",
])

function readSkillsFile(path: string): Skill[] {
  if (!existsSync(path)) return []
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"))
    const parsed = skillsFileSchema.safeParse(raw)
    if (!parsed.success) return []
    return parsed.data
  } catch {
    return []
  }
}

export function loadSkills(cwd: string): Skill[] {
  const global = readSkillsFile(GLOBAL_SKILLS_PATH)
  const project = readSkillsFile(join(cwd, ".papercode", "skills.json"))

  const merged = new Map<string, Skill>()
  for (const skill of global) merged.set(skill.name, skill)
  for (const skill of project) merged.set(skill.name, skill)

  return Array.from(merged.values()).filter(s => !BUILTIN_NAMES.has(s.name))
}
