import React from "react";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Box, Text } from "ink";
import { useTheme } from "../themes/context.js";
import { useViewport } from "../useViewport.js";
import type { Mode } from "../../tools/permissions.js";

export type StatusLineProps = {
  mode: Mode; model?: string; provider?: string; thinking?: string;
  tokens?: number; contextLimit?: number; cacheRate?: number; cost?: number;
};

export function tildify(dir: string): string {
  const home = os.homedir();
  if (dir === home) return "~";
  return dir.startsWith(home + path.sep) ? `~/${dir.slice(home.length + 1).split(path.sep).join("/")}` : dir.split(path.sep).join("/");
}

export function meter(fraction: number, width = 10): string {
  const filled = Math.round(Math.max(0, Math.min(1, fraction)) * width);
  return "━".repeat(filled) + "─".repeat(width - filled);
}

export function compactCount(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

export function gitBranch(cwd: string): string | undefined {
  let dir = path.resolve(cwd);
  for (;;) {
    try {
      const git = path.join(dir, ".git");
      const stat = fs.statSync(git);
      const gitDir = stat.isDirectory() ? git : path.resolve(dir, fs.readFileSync(git, "utf8").trim().replace(/^gitdir:\s*/, ""));
      const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
      return head.startsWith("ref: refs/heads/") ? head.slice(16) : head.slice(0, 7);
    } catch {}
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export function Header({ cwd, contextFiles, busy = false }: { cwd: string; contextFiles?: string[]; busy?: boolean }) {
  const theme = useTheme();
  const { columns } = useViewport();
  const branch = React.useMemo(() => gitBranch(cwd), [cwd, busy]);
  return (
    <Box height={3} flexShrink={0} paddingX={2} paddingTop={1} alignItems="flex-start" borderStyle="single" borderColor={theme.border} borderTop={false} borderLeft={false} borderRight={false}>
      <Text color={theme.primary} bold>papercode</Text>
      <Text color={theme.border}>  /  </Text>
      <Box flexGrow={1} minWidth={0}><Text color={theme.text} wrap="truncate-middle">{path.basename(cwd) || cwd}</Text></Box>
      {columns >= 70 && branch && <Box width={Math.min(24, Math.floor(columns / 4))} marginLeft={2}><Text color={theme.muted} wrap="truncate-end">{branch}</Text></Box>}
      {contextFiles && columns >= 100 && <Text color={theme.faint}>{contextFiles.length} instructions</Text>}
      <Text color={busy ? theme.primary : theme.success}>{busy ? "  ● working" : "  ● ready"}</Text>
    </Box>
  );
}

export function StatusLine({ mode, model, provider, thinking, tokens, contextLimit, cost }: StatusLineProps) {
  const theme = useTheme();
  const { columns } = useViewport();
  const fraction = tokens && contextLimit ? tokens / contextLimit : 0;
  const right = `${Math.round(fraction * 100)}% context${columns >= 80 ? ` · ${compactCount(tokens ?? 0)}/${compactCount(contextLimit ?? 0)}` : ""}${columns >= 110 ? ` · $${(cost ?? 0).toFixed(2)}` : ""}`;
  return (
    <Box height={1} flexShrink={0} paddingX={2} overflow="hidden">
      <Box flexGrow={1} minWidth={0} marginRight={2}>
        <Text wrap="truncate-end">
          <Text color={mode === "plan" ? theme.accent : theme.primary} bold>{mode.toUpperCase()}</Text>
          <Text color={theme.border}> · </Text>
          <Text color={theme.muted}>{model ?? "No model"}{columns >= 100 && provider ? ` / ${provider}` : ""}</Text>
          {thinking && thinking !== "off" && columns >= 120 && <Text color={theme.accent}> · {thinking}</Text>}
        </Text>
      </Box>
      <Box width={right.length} flexShrink={0}><Text color={fraction > 0.8 ? theme.warning : theme.muted}>{right}</Text></Box>
    </Box>
  );
}
