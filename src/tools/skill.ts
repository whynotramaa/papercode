import path from "node:path";
import { z } from "zod";
import { loadSkills } from "../config/skills.js";
import type { Tool } from "./types.js";

const schema = z.object({
  name: z.string().describe("Skill name from the available skills list."),
});

export const skillTool: Tool<typeof schema> = {
  name: "skill",
  description:
    "Load the full instructions for one of the available skills listed in the system prompt. " +
    "Call it as soon as a task matches a skill's description, then follow the instructions it returns.",
  schema,
  permission: "read-only",
  preview: (a) => `Load skill ${a.name}`,

  async run(args, ctx) {
    const skill = loadSkills(ctx.root).skills.find((s) => s.name.toLowerCase() === args.name.toLowerCase());
    if (!skill) return { content: `No skill named "${args.name}".`, isError: true };
    const where = skill.path ? `\n\nSkill directory: ${path.dirname(skill.path)}` : "";
    return { content: `${skill.prompt}${where}`, display: skill.name };
  },
};
