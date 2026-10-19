import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../themes/context.js";
import { useViewport } from "../useViewport.js";
import { WORDMARK } from "../brand.js";

export function Banner({ compact = false }: { cwd?: string; compact?: boolean }) {
  const theme = useTheme();
  const [frame, setFrame] = useState(0);
  const { columns, rows } = useViewport();
  const small = compact || columns < 64 || rows < 24;
  const mark = WORDMARK;
  const width = mark[0]!.length;
  useEffect(() => {
    if (small || process.env.PAPERCODE_REDUCED_MOTION === "1" || process.env.TERM === "dumb" || process.env.NO_COLOR !== undefined) return;
    let tick = 0;
    const timer = setInterval(() => {
      tick += 2;
      setFrame(tick);
      if (tick > width + 5) clearInterval(timer);
    }, 45);
    return () => clearInterval(timer);
  }, [small, width]);

  return (
    <Box flexDirection="column" alignItems="center" marginBottom={small ? 1 : 2} flexShrink={0}>
      {small ? <Text color={theme.primary} bold>papercode</Text> : mark.map((line, i) => (
        <Text key={i} color={theme.primary}>
          {line.slice(0, Math.max(0, frame - 4))}
          <Text color={theme.text}>{line.slice(Math.max(0, frame - 4), frame)}</Text>
          {line.slice(frame)}
        </Text>
      ))}
      {!small && <Box marginTop={1}><Text color={theme.muted}>Your code. Your model. Your terminal.</Text></Box>}
    </Box>
  );
}
