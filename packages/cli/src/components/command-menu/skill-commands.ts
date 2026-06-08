import type { Skill } from "@papercode/shared"
import type { Command } from "./types"

export function skillsToCommands(skills: Skill[]): Command[] {
  return skills.map((skill): Command => ({
    name: skill.name,
    description: skill.description,
    value: `/${skill.name}`,
    isSkill: true,
    action: (ctx) => {
      if (ctx.submitMessage) {
        ctx.submitMessage(skill.prompt, skill.mode)
      } else {
        ctx.navigate("/new", { state: { message: skill.prompt, mode: skill.mode ?? "BUILD" } })
      }
    },
  }))
}
