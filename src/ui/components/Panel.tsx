import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../themes/context.js";
export function Panel({ title, corner, children }: { title: string; corner?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={2} paddingY={1}>
    <Box marginBottom={1} height={1} flexShrink={0}>
      <Box flexGrow={1} minWidth={0}><Text color={theme.primary} bold wrap="truncate-end">{title}</Text></Box>
      {corner && <Box flexShrink={0} marginLeft={2}><Text color={theme.muted}>{corner}</Text></Box>}
    </Box>
    {children}
  </Box>;
}
