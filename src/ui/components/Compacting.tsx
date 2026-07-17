import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../themes/context.js";


const TRACK = 18;

const REST = 4;
const FRAME_MS = 110;

const HALF = Math.floor((TRACK - 2) / 2);

export function Compacting({ elapsed }: { elapsed?: number }) {
  const theme = useTheme();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => (t + 1) % (HALF + REST)), FRAME_MS);
    return () => clearInterval(timer);
  }, []);

  const squeeze = Math.min(tick, HALF);
  const gap = " ".repeat(squeeze);
  const blocks = "▓".repeat(Math.max(0, TRACK - 2 * squeeze - 2));

  return (
    <Box paddingLeft={2}>
      <Text color={theme.faint}>{gap}</Text>
      <Text color={theme.accent}>{"⟩"}</Text>
      <Text color={theme.primary}>{blocks}</Text>
      <Text color={theme.accent}>{"⟨"}</Text>
      <Text color={theme.faint}>{gap}</Text>
      <Text color={theme.muted}>{"  Compacting context"}</Text>
      {elapsed !== undefined && elapsed > 0 && <Text color={theme.faint}>{`  ${elapsed}s`}</Text>}
    </Box>
  );
}
