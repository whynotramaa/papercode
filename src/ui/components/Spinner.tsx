import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../themes/context.js";
import { workingVerb } from "../brand.js";


const TRACK = 3;

const PATH = [0, 1, 2, 1] as const;

const FRAME_MS = 140;

const VERB_FRAMES = 20;

export function Spinner({ label, elapsed, tokens }: { label?: string; elapsed?: number; tokens?: number }) {
  const theme = useTheme();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), FRAME_MS);
    return () => clearInterval(timer);
  }, []);

  const head = PATH[tick % PATH.length]!;
  const trail = PATH[(tick - 1 + PATH.length) % PATH.length]!;
  const verb = label ?? workingVerb(Math.floor(tick / VERB_FRAMES));

  const meta: string[] = [];
  if (elapsed !== undefined && elapsed > 0) meta.push(`${elapsed}s`);
  if (tokens) meta.push(`⇅${(tokens / 1000).toFixed(1)}k`);

  return (
    <Box paddingLeft={2}>
      {Array.from({ length: TRACK }, (_, i) => (
        <Text key={i} color={i === head ? theme.primary : i === trail ? theme.muted : theme.faint}>
          ·
        </Text>
      ))}
      <Text color={theme.muted}>{` ${verb}`}</Text>
      {meta.length > 0 && <Text color={theme.faint}>{`  ${meta.join(" · ")}`}</Text>}
      {elapsed !== undefined && elapsed > 1 && <Text color={theme.faint}>{"  esc to interrupt"}</Text>}
    </Box>
  );
}
