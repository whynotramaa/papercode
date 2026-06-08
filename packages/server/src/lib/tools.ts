import { tool } from "ai"
import { z } from "zod"
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from "node:fs"
import { resolve, normalize, dirname, join, relative } from "node:path"
import { execSync } from "node:child_process"

const MAX_READ_BYTES  = 10_000
const MAX_BASH_BYTES  = 50_000
const BASH_TIMEOUT_MS = 30_000
const GLOB_MAX        = 500

function resolveSafePath(cwd: string, userPath: string): string {
  const normalizedCwd = normalize(cwd)
  const abs = normalize(resolve(cwd, userPath))
  if (!abs.startsWith(normalizedCwd)) {
    throw new Error(`Path outside working directory: ${userPath}`)
  }
  return abs
}

function globPattern(pattern: string, base: string, maxResults: number): string[] {
  // Convert glob pattern to regex
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§DOUBLE§")
    .replace(/\*/g, "[^/\\\\]*")
    .replace(/§DOUBLE§/g, ".*")
    .replace(/\?/g, "[^/\\\\]")
  const regex = new RegExp(`^${regexStr}$`, process.platform === "win32" ? "i" : "")

  const results: string[] = []

  function walk(dir: string) {
    if (results.length >= maxResults) return
    let names: string[]
    try { names = readdirSync(dir) as string[] } catch { return }
    for (const name of names) {
      if (results.length >= maxResults) break
      const fullPath = join(dir, name)
      const rel = relative(base, fullPath).replace(/\\/g, "/")
      let isDir = false
      try { isDir = statSync(fullPath).isDirectory() } catch { continue }
      if (isDir) {
        walk(fullPath)
      } else if (regex.test(rel)) {
        results.push(rel)
      }
    }
  }

  walk(base)
  return results
}

function truncate(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, "utf-8") <= maxBytes) return text
  const kbSize = Math.round(maxBytes / 1000)
  return text.slice(0, maxBytes) + `\n[...output truncated at ${kbSize}KB]`
}

type ToolResult = { success: boolean; output: string }

const readOnlyTools = (cwd: string) => ({
  read_file: tool({
    description: "Read file contents. Use offset/limit (line numbers) for large files.",
    inputSchema: z.object({
      path: z.string(),
      offset: z.number().int().nonnegative().optional(),
      limit: z.number().int().positive().optional(),
    }),
    execute: async ({ path, offset = 0, limit }): Promise<ToolResult> => {
      try {
        const abs = resolveSafePath(cwd, path)
        if (!existsSync(abs)) return { success: false, output: `File not found: ${path}` }
        const content = readFileSync(abs, "utf-8")
        const lines = content.split("\n")
        const slice = limit != null ? lines.slice(offset, offset + limit) : lines.slice(offset)
        return { success: true, output: truncate(slice.join("\n"), MAX_READ_BYTES) }
      } catch (e) {
        return { success: false, output: e instanceof Error ? e.message : String(e) }
      }
    },
  }),

  grep: tool({
    description: "Search file contents using a regex pattern. Returns matching lines with line numbers.",
    inputSchema: z.object({
      pattern: z.string(),
      path: z.string().optional(),
      glob: z.string().optional(),
      case_insensitive: z.boolean().optional(),
    }),
    execute: async ({ pattern, path, glob, case_insensitive = false }): Promise<ToolResult> => {
      try {
        const target = path ? resolveSafePath(cwd, path) : cwd
        const includeFlag = glob ? `--include="${glob}"` : ""
        const caseFlag = case_insensitive ? "-i" : ""
        const escapedPattern = pattern.replace(/"/g, '\\"')
        const cmd = `grep -r -n ${caseFlag} ${includeFlag} "${escapedPattern}" "${target}"`
        const output = execSync(cmd, {
          encoding: "utf-8",
          maxBuffer: MAX_READ_BYTES * 4,
          timeout: 10_000,
          cwd,
        })
        return { success: true, output: truncate(output, MAX_READ_BYTES) }
      } catch (e: any) {
        if (e.status === 1) return { success: true, output: "(no matches)" }
        return { success: false, output: e.message ?? "grep failed" }
      }
    },
  }),

  glob: tool({
    description: "Find files matching a glob pattern relative to the working directory.",
    inputSchema: z.object({
      pattern: z.string(),
      path: z.string().optional(),
    }),
    execute: async ({ pattern, path }): Promise<ToolResult> => {
      try {
        const base = path ? resolveSafePath(cwd, path) : cwd
        const matches = globPattern(pattern, base, GLOB_MAX)
        if (matches.length === 0) return { success: true, output: "(no matches)" }
        return { success: true, output: truncate(matches.join("\n"), MAX_READ_BYTES) }
      } catch (e) {
        return { success: false, output: e instanceof Error ? e.message : String(e) }
      }
    },
  }),

  list_directory: tool({
    description: "List files and directories at a path.",
    inputSchema: z.object({
      path: z.string().optional(),
    }),
    execute: async ({ path = "." }): Promise<ToolResult> => {
      try {
        const abs = resolveSafePath(cwd, path)
        if (!existsSync(abs)) return { success: false, output: `Directory not found: ${path}` }
        const names = (readdirSync(abs) as string[]).slice(0, GLOB_MAX)
        const lines = names.map(name => {
          let isDir = false
          try { isDir = statSync(join(abs, name)).isDirectory() } catch { /* skip */ }
          return `${isDir ? "d" : "f"} ${name}`
        })
        return { success: true, output: lines.join("\n") }
      } catch (e) {
        return { success: false, output: e instanceof Error ? e.message : String(e) }
      }
    },
  }),
})

const buildOnlyTools = (cwd: string) => ({
  write_file: tool({
    description: "Create or overwrite a file with the given content.",
    inputSchema: z.object({
      path: z.string(),
      content: z.string(),
    }),
    execute: async ({ path, content }): Promise<ToolResult> => {
      try {
        const abs = resolveSafePath(cwd, path)
        mkdirSync(dirname(abs), { recursive: true })
        writeFileSync(abs, content, "utf-8")
        return { success: true, output: `Written: ${path}` }
      } catch (e) {
        return { success: false, output: e instanceof Error ? e.message : String(e) }
      }
    },
  }),

  edit_file: tool({
    description: "Replace an exact string in a file. old_string must appear exactly once.",
    inputSchema: z.object({
      path: z.string(),
      old_string: z.string(),
      new_string: z.string(),
    }),
    execute: async ({ path, old_string, new_string }): Promise<ToolResult> => {
      try {
        const abs = resolveSafePath(cwd, path)
        if (!existsSync(abs)) return { success: false, output: `File not found: ${path}` }
        const original = readFileSync(abs, "utf-8")
        const count = original.split(old_string).length - 1
        if (count === 0) return { success: false, output: "old_string not found in file" }
        if (count > 1) return { success: false, output: `old_string matches ${count} times — must be unique` }
        writeFileSync(abs, original.replace(old_string, new_string), "utf-8")
        return { success: true, output: `Edited: ${path}` }
      } catch (e) {
        return { success: false, output: e instanceof Error ? e.message : String(e) }
      }
    },
  }),

  bash: tool({
    description: "Execute a shell command in the working directory. Output capped at 50KB.",
    inputSchema: z.object({
      command: z.string(),
      timeout: z.number().int().positive().optional(),
    }),
    execute: async ({ command, timeout = BASH_TIMEOUT_MS }): Promise<ToolResult> => {
      try {
        const output = execSync(command, {
          cwd,
          encoding: "utf-8",
          maxBuffer: MAX_BASH_BYTES * 2,
          timeout,
        })
        return { success: true, output: truncate(output, MAX_BASH_BYTES) }
      } catch (e: any) {
        const msg = [e.stdout, e.stderr].filter(Boolean).join("\n") || e.message || String(e)
        return { success: false, output: truncate(msg, MAX_BASH_BYTES) }
      }
    },
  }),
})

export function buildTools(cwd: string, mode: "BUILD" | "PLAN") {
  if (mode === "PLAN") return readOnlyTools(cwd)
  return { ...readOnlyTools(cwd), ...buildOnlyTools(cwd) }
}
