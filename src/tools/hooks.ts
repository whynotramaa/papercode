import { spawn } from "node:child_process";
import { loadSettings } from "../config/settings.js";

export type HookPhase = "preToolUse" | "postToolUse";

function run(command: string, input: string, cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true, timeout: 60_000 });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => resolve({ code: 1, stdout, stderr: err.message }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.stdin.end(input);
  });
}

export async function runHooks(
  phase: HookPhase,
  payload: { tool: string; args: unknown; result?: string },
  cwd: string,
): Promise<{ blocked?: string; output: string }> {
  const hooks = loadSettings().hooks?.[phase] ?? [];
  const outputs: string[] = [];
  for (const hook of hooks) {
    if (hook.matcher && !new RegExp(hook.matcher).test(payload.tool)) continue;
    const { code, stdout, stderr } = await run(hook.command, JSON.stringify({ phase, cwd, ...payload }), cwd);
    if (phase === "preToolUse" && code === 2) return { blocked: stderr.trim() || stdout.trim() || "Blocked by a hook.", output: "" };
    if (stdout.trim()) outputs.push(stdout.trim());
  }
  return { output: outputs.join("\n") };
}
