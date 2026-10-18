import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../themes/context.js";
import type { Diff } from "../diff.js";

export function DiffView({ diff, maxLines = 24 }: { diff: Diff; maxLines?: number }) {
  const theme = useTheme();
  const shown = diff.lines.slice(0, maxLines);
  const hidden = diff.lines.length - shown.length;
  const width = String(Math.max(0, ...diff.lines.map((l) => l.line ?? 0))).length;

  return (
    <Box flexDirection="column">
      {shown.map((l, i) => {
        if (l.kind === "gap") return <Text key={i} color={theme.faint}>{" ".repeat(width)} ⋯</Text>;
        const color = l.kind === "add" ? theme.diffAdd : l.kind === "del" ? theme.diffRemove : theme.muted;
        const mark = l.kind === "add" ? "+" : l.kind === "del" ? "-" : " ";
        return (
          <Text key={i} wrap="truncate-end">
            <Text color={theme.faint}>{String(l.line ?? "").padStart(width)} </Text>
            <Text color={color}>
              {mark} {l.text}
            </Text>
          </Text>
        );
      })}
      {hidden > 0 && <Text color={theme.faint}>{`… +${hidden} more lines`}</Text>}
    </Box>
  );
}
