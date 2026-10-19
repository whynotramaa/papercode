import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../themes/context.js";
import { useElementWidth } from "../useViewport.js";
export type Hint = { key: string; action: string };
export function Hints({ hints }: { hints: Hint[] }) {
  const theme = useTheme();
  const { ref, width } = useElementWidth();
  let used = 0;
  const priority = (hint: Hint) => hint.key.toLowerCase() === "enter" ? 0 : hint.key.toLowerCase() === "esc" ? 1 : 2;
  const selected = [...hints].sort((a, b) => priority(a) - priority(b)).filter((hint) => {
    const length = [...hint.key, ...hint.action].length + 1 + (used ? 3 : 0);
    if (used + length > width) return false;
    used += length;
    return true;
  });
  const visible = hints.filter((hint) => selected.includes(hint));
  return hints.length ? <Box ref={ref} width="100%" height={1} flexShrink={0} minWidth={0} overflow="hidden">
    <Text wrap="truncate-end">{visible.map((hint, i) => (
      <Text key={hint.key}>
        {i > 0 && <Text color={theme.border}>{" · "}</Text>}
        <Text color={theme.muted}>{hint.key.toLowerCase()}</Text><Text color={theme.faint}> {hint.action}</Text>
      </Text>
    ))}</Text>
  </Box> : null;
}
