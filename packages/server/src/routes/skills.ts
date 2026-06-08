import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { isAbsolute, join, dirname } from "node:path"
import { homedir } from "node:os"
import z from "zod"
import { skillSchema, skillsFileSchema } from "@papercode/shared"
import { loadSkills } from "../lib/skills"

const saveSkillSchema = z.object({
  skill: skillSchema,
  location: z.enum(["global", "project"]),
  cwd: z.string().optional(),
})

function getSkillsPath(location: "global" | "project", cwd: string): string {
  if (location === "global") return join(homedir(), ".papercode", "skills.json")
  return join(cwd, ".papercode", "skills.json")
}

function saveSkill(skill: z.infer<typeof skillSchema>, location: "global" | "project", cwd: string) {
  const filePath = getSkillsPath(location, cwd)
  mkdirSync(dirname(filePath), { recursive: true })

  let existing: z.infer<typeof skillSchema>[] = []
  if (existsSync(filePath)) {
    try {
      const parsed = skillsFileSchema.safeParse(JSON.parse(readFileSync(filePath, "utf-8")))
      if (parsed.success) existing = parsed.data
    } catch { /* start fresh */ }
  }

  const idx = existing.findIndex(s => s.name === skill.name)
  if (idx >= 0) existing[idx] = skill
  else existing.push(skill)

  writeFileSync(filePath, JSON.stringify(existing, null, 2), "utf-8")
}

const app = new Hono()
  .get("/", (c) => {
    const cwd = c.req.query("cwd")
    const resolvedCwd = cwd && isAbsolute(cwd) ? cwd : process.cwd()
    return c.json(loadSkills(resolvedCwd))
  })
  .post("/", zValidator("json", saveSkillSchema), (c) => {
    const { skill, location, cwd } = c.req.valid("json")
    const resolvedCwd = cwd && isAbsolute(cwd) ? cwd : process.cwd()
    saveSkill(skill, location, resolvedCwd)
    return c.json(loadSkills(resolvedCwd))
  })

export default app
