import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../themes/context.js";
import { MARK } from "../brand.js";


export function Panel({
  title,
  corner,
  children,
}: {
  title: string;
  
  corner?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text color={theme.primary}>{MARK} </Text>
        <Text color={theme.text} bold>
          {title}
        </Text>
        <Text color={theme.faint}>{"  ── "}</Text>
        {corner && <Text color={theme.muted}>{corner}</Text>}
      </Box>
      {children}
    </Box>
  );
}
