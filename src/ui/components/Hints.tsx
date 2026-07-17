import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../themes/context.js";

export type Hint = { key: string; action: string };


export function Hints({ hints }: { hints: Hint[] }) {
  const theme = useTheme();
  if (hints.length === 0) return null;

  return (
    <Box marginTop={1}>
      {hints.map((hint, i) => (
        <Box key={hint.key}>
          {i > 0 && <Text color={theme.faint}>{"  │  "}</Text>}
          <Text color={theme.text} bold>
            {hint.key}
          </Text>
          <Text color={theme.faint}>:</Text>
          <Text color={theme.muted}>{hint.action}</Text>
        </Box>
      ))}
    </Box>
  );
}
