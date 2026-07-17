import React from "react";
import os from "node:os";
import path from "node:path";
import { Box, Text } from "ink";
import { useTheme } from "../themes/context.js";
import { MARK } from "../brand.js";
import type { Mode } from "../../tools/permissions.js";

export type HeaderProps = {
  cwd: string;
  mode: Mode;
  model?: string;
  provider?: string;
  tokens?: number;
  contextLimit?: number;
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


export function Header({ cwd, mode, model, provider, tokens, contextLimit }: HeaderProps) {
  const theme = useTheme();
  const plan = mode === "plan";

  const fraction = tokens && contextLimit ? tokens / contextLimit : 0;
  const pct = fraction * 100;
  const meterColor = pct > 80 ? theme.warning : theme.faint;

  return (
    <Box justifyContent="space-between" marginBottom={1}>
      <Box>
        <Text color={theme.primary} bold>
          {MARK} papercode
        </Text>
        <Text color={theme.faint}>{"  "}</Text>
        <Text color={theme.muted}>{tildify(cwd)}</Text>
        <Text color={theme.faint}>{"  "}</Text>
        <Text backgroundColor={plan ? theme.accent : theme.primary} color={theme.panel} bold>
          {plan ? " PLAN " : " BUILD "}
        </Text>
      </Box>

      <Box>
        {model && (
          <>
            <Text color={theme.muted}>{model}</Text>
            {provider && <Text color={theme.faint}>{` · ${provider}`}</Text>}
            <Text color={theme.faint}>{"  │  "}</Text>
          </>
        )}
        <Text color={meterColor}>{meter(fraction)}</Text>
        <Text color={theme.faint}>{` ${pct.toFixed(0)}%`}</Text>
      </Box>
    </Box>
  );
}
