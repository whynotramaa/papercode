import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { configDir } from "../config/paths.js";
import { truncate, type AnyTool } from "./types.js";

type ServerConfig = { command?: string; args?: string[]; env?: Record<string, string>; url?: string; headers?: Record<string, string> };

function readServers(file: string): Record<string, ServerConfig> {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { mcpServers?: Record<string, ServerConfig> };
    return raw.mcpServers ?? {};
  } catch {
    return {};
  }
}

export function mcpServers(cwd: string): Record<string, ServerConfig> {
  return { ...readServers(path.join(configDir(), "mcp.json")), ...readServers(path.join(cwd, ".mcp.json")) };
}

const clients: Client[] = [];

async function connect(name: string, config: ServerConfig): Promise<AnyTool[]> {
  const transport = config.url
    ? new StreamableHTTPClientTransport(new URL(config.url), { requestInit: { headers: config.headers } })
    : new StdioClientTransport({
        command: config.command!,
        args: config.args ?? [],
        env: { ...(process.env as Record<string, string>), ...config.env },
        stderr: "ignore",
      });
  const client = new Client({ name: "papercode", version: "0.1.0" });
  await client.connect(transport);
  clients.push(client);

  const { tools } = await client.listTools();
  return tools.map((t) => ({
    name: `mcp__${name}__${t.name}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64),
    description: t.description ?? `${t.name} from the ${name} MCP server.`,
    schema: z.record(z.string(), z.unknown()),
    parameters: t.inputSchema as Record<string, unknown>,
    permission: t.annotations?.readOnlyHint ? "read-only" : "dangerous",
    preview: (args: unknown) => `${name} · ${t.name} ${JSON.stringify(args)}`,
    async run(args: Record<string, unknown>, ctx) {
      const result = await client.callTool({ name: t.name, arguments: args }, undefined, { signal: ctx.signal });
      const parts = Array.isArray(result.content) ? result.content : [];
      const text = parts
        .map((p: { type: string; text?: string }) => (p.type === "text" ? p.text : `[${p.type} content]`))
        .join("\n");
      return { content: truncate(text || "(no output)"), isError: Boolean(result.isError) };
    },
  }));
}

export async function connectMcp(cwd: string): Promise<{ tools: AnyTool[]; errors: string[] }> {
  const tools: AnyTool[] = [];
  const errors: string[] = [];
  await Promise.all(
    Object.entries(mcpServers(cwd)).map(async ([name, config]) => {
      try {
        tools.push(...(await connect(name, config)));
      } catch (err) {
        errors.push(`MCP server ${name}: ${(err as Error).message}`);
      }
    }),
  );
  return { tools, errors };
}

export async function closeMcp(): Promise<void> {
  await Promise.allSettled(clients.splice(0).map((c) => c.close()));
}
