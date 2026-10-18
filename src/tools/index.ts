import type OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { readTool } from "./read.js";
import { writeTool } from "./write.js";
import { editTool } from "./edit.js";
import { lsTool } from "./ls.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";
import { bashTool } from "./bash.js";
import { skillTool } from "./skill.js";
import { runHooks } from "./hooks.js";
import { checkMode, type Mode } from "./permissions.js";
import type { AnyTool, Tool, ToolContext, ToolResult } from "./types.js";

export const ALL_TOOLS: AnyTool[] = [readTool, lsTool, globTool, grepTool, editTool, writeTool, bashTool, skillTool];

export function registerTools(tools: AnyTool[]): void {
  for (const tool of tools) if (!getTool(tool.name)) ALL_TOOLS.push(tool);
  definitions = undefined;
}

export function getTool(name: string): AnyTool | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}


let definitions: OpenAI.Chat.Completions.ChatCompletionFunctionTool[] | undefined;

export function toolDefinitions(): OpenAI.Chat.Completions.ChatCompletionFunctionTool[] {
  definitions ??= ALL_TOOLS.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters:
        tool.parameters ?? (zodToJsonSchema(tool.schema, { target: "openAi", $refStrategy: "none" }) as Record<string, unknown>),
    },
  }));
  return definitions;
}

export function isReadOnlyTool(name: string): boolean {
  return getTool(name)?.permission === "read-only";
}

export type ExecuteOptions = {
  name: string;
  rawArgs: string;
  mode: Mode;
  ctx: ToolContext;
  
  requestApproval: (tool: AnyTool, args: unknown) => Promise<boolean | { denied: string }>;
};


export async function executeTool(opts: ExecuteOptions): Promise<ToolResult> {
  const tool = getTool(opts.name);
  if (!tool) {
    const known = ALL_TOOLS.map((t) => t.name).join(", ");
    return { content: `Unknown tool "${opts.name}". Available tools: ${known}.`, isError: true };
  }

  const gate = checkMode(tool.permission, opts.mode);
  if (!gate.allow) return { content: gate.reason, isError: true };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(opts.rawArgs || "{}");
  } catch {
    return {
      content: `Arguments for ${tool.name} were not valid JSON. Send a single well-formed JSON object.`,
      isError: true,
    };
  }

  // Models routinely invent fields and omit required ones; catching it here
  // gives them a precise, actionable error instead of a crash inside run().
  const parsed = tool.schema.safeParse(parsedJson);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return { content: `Invalid arguments for ${tool.name} — ${issues}`, isError: true };
  }

  const args = parsed.data;

  const pre = await runHooks("preToolUse", { tool: tool.name, args }, opts.ctx.root);
  if (pre.blocked) return { content: `A hook blocked ${tool.name}: ${pre.blocked}`, isError: true };

  if (tool.permission !== "read-only") {
    const answer = await opts.requestApproval(tool, args);
    if (answer !== true) {
      const why = typeof answer === "object" && answer.denied.trim() ? ` They said: ${answer.denied.trim()}` : "";
      return {
        content:
          `The user denied permission to run ${tool.name}.${why} Do not retry the same call. ` +
          `Adjust based on their feedback, or ask what they would prefer.`,
        isError: true,
      };
    }
  }

  let result: ToolResult;
  try {
    result = await tool.run(args, opts.ctx);
  } catch (err) {
    result = { content: `${tool.name} failed: ${(err as Error).message}`, isError: true };
  }
  const post = await runHooks("postToolUse", { tool: tool.name, args, result: result.content }, opts.ctx.root);
  return post.output ? { ...result, content: `${result.content}\n\n[hook]\n${post.output}` } : result;
}

export type { AnyTool, Tool, ToolContext, ToolResult };
