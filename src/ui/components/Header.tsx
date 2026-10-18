import React from "react";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Box, Text } from "ink";
import { useTheme } from "../themes/context.js";
import { MARK } from "../brand.js";
import type { Mode } from "../../tools/permissions.js";

export type StatusLineProps = {
  mode: Mode;
  model?: string;
  provider?: string;
  thinking?: string;
  tokens?: number;
  contextLimit?: number;
  cacheRate?: number;
  cost?: number;
};

export function tildify(dir: string): string {
  const home = os.homedir();
  if (dir === home) return "~";
  if (dir.startsWith(home + path.sep)) {
    return `~/${dir.slice(home.length + 1).split(path.sep).join("/")}`;
  }
  return dir.split(path.sep).join("/");
}


export function meter(fraction: number, width = 5): string {
  const filled = Math.round(Math.max(0, Math.min(1, fraction)) * width);
  return "▰".repeat(filled) + "▱".repeat(width - filled);
}


export function gitBranch(cwd: string): string | undefined {
  let dir = path.resolve(cwd);
  for (;;) {
    try {
      const head = fs.readFileSync(path.join(dir, ".git", "HEAD"), "utf8").trim();
      return head.startsWith("ref: refs/heads/") ? head.slice(16) : head.slice(0, 7);
    } catch {}
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function compactCount(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

export function Header({ cwd, contextFiles }: { cwd: string; contextFiles?: string[] }) {
  const theme = useTheme();
  const branch = gitBranch(cwd);

  return (
    <Box justifyContent="space-between" marginBottom={1}>
      <Box>
        <Text color={theme.primary} bold>
          {MARK} papercode
        </Text>
        <Text color={theme.muted}>{"  "}{tildify(cwd)}</Text>
        {branch && <Text color={theme.faint}>{"  "}{branch}</Text>}
      </Box>
      {contextFiles && contextFiles.length > 0 && (
        <Text color={theme.faint}>{contextFiles.map((f) => path.basename(f)).join(" · ")} loaded</Text>
      )}
    </Box>
  );
}

export function StatusLine({ mode, model, provider, thinking, tokens, contextLimit, cacheRate, cost }: StatusLineProps) {
  const theme = useTheme();
  const plan = mode === "plan";

  const fraction = tokens && contextLimit ? tokens / contextLimit : 0;
  const pct = fraction * 100;
  const meterColor = pct > 80 ? theme.warning : theme.faint;

  return (
    <Box justifyContent="space-between">
      <Box>
        <Text backgroundColor={plan ? theme.accent : theme.primary} color={theme.panel} bold>
          {plan ? " PLAN " : " BUILD "}
        </Text>
        {model && <Text color={theme.muted}>{" "}{model}</Text>}
        {provider && <Text color={theme.faint}>{` · ${provider}`}</Text>}
        {thinking && thinking !== "off" && <Text color={theme.accent}>{`  ✻ ${thinking}`}</Text>}
      </Box>

      <Box>
        <Text color={meterColor}>{meter(fraction)}</Text>
        <Text color={theme.faint}>{` ${pct.toFixed(0)}%`}</Text>
        {contextLimit ? <Text color={theme.faint}>{` ${compactCount(tokens ?? 0)}/${compactCount(contextLimit)}`}</Text> : null}
        {cacheRate !== undefined && <Text color={theme.faint}>{`   cache ${Math.round(cacheRate * 100)}%`}</Text>}
        {cost ? <Text color={theme.muted}>{`   $${cost.toFixed(2)}`}</Text> : null}
      </Box>
    </Box>
  );
}
