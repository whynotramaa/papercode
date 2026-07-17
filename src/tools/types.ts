import type { z } from "zod";
import type { PermissionLevel } from "./permissions.js";

export type ToolContext = {
  
  root: string;
  signal: AbortSignal;
};

export type ToolResult = {
  
  content: string;
  isError?: boolean;
  
  display?: string;
};

export type Tool<S extends z.ZodType = z.ZodType> = {
  name: string;
  
  description: string;
  schema: S;
  permission: PermissionLevel;
  
  target?: (args: z.infer<S>) => string | undefined;
  
  preview?: (args: z.infer<S>) => string;
  run: (args: z.infer<S>, ctx: ToolContext) => Promise<ToolResult>;
};


export type AnyTool = {
  name: string;
  description: string;
  schema: z.ZodType;
  permission: PermissionLevel;
  
  target?: (args: any) => string | undefined;
  preview?: (args: any) => string;
  run: (args: any, ctx: ToolContext) => Promise<ToolResult>;
  
};


export const MAX_OUTPUT_CHARS = 30_000;

export function truncate(text: string, limit = MAX_OUTPUT_CHARS): string {
  if (text.length <= limit) return text;
  const omitted = text.length - limit;
  return `${text.slice(0, limit)}\n\n[... truncated ${omitted.toLocaleString()} characters. Narrow the query or use offset/limit to see more.]`;
}
