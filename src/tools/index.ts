import type OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { readTool } from "./read.js";
import { writeTool } from "./write.js";
import { editTool } from "./edit.js";
import { lsTool } from "./ls.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";
import { bashTool } from "./bash.js";
import { checkMode, type Mode } from "./permissions.js";
import type { AnyTool, Tool, ToolContext, ToolResult } from "./types.js";

export const ALL_TOOLS: AnyTool[] = [readTool, lsTool, globTool, grepTool, editTool, writeTool, bashTool];

export function getTool(name: string): AnyTool | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}


export function toolDefinitions(mode: Mode): OpenAI.Chat.Completions.ChatCompletionFunctionTool[] {
  return ALL_TOOLS.filter((tool) => checkMode(tool.permission, mode).allow).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.schema, { target: "openAi", $refStrategy: "none" }) as Record<string, unknown>,
    },
  }));
}

export type ExecuteOptions = {
  name: string;
  rawArgs: string;
  mode: Mode;
  ctx: ToolContext;
  
  requestApproval: (tool: AnyTool, args: unknown) => Promise<boolean>;
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

  if (tool.permission !== "read-only") {
    const approved = await opts.requestApproval(tool, args);
    if (!approved) {
      return {
        content:
          `The user denied permission to run ${tool.name}. Do not retry it. Ask what they would ` +
          `prefer, or continue with a different approach.`,
        isError: true,
      };
    }
  }

  try {
    return await tool.run(args, opts.ctx);
  } catch (err) {
    return { content: `${tool.name} failed: ${(err as Error).message}`, isError: true };
  }
}

export type { AnyTool, Tool, ToolContext, ToolResult };
