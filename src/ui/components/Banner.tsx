import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../themes/context.js";
import { WORDMARK, TAGLINE, VERSION, pet, type PetMood } from "../brand.js";
import { tildify } from "./Header.js";


const SHINE_WIDTH = 8;

const SHINE_EDGE = 3;

const SHINE_REST = 28;
const FRAME_MS = 90;

const BLINK_FRAMES = 2;

const WINK_EVERY = 3;

function clampSlice(line: string, from: number, to: number): string {
  const a = Math.max(0, Math.min(line.length, from));
  const b = Math.max(a, Math.min(line.length, to));
  return line.slice(a, b);
}


export function Banner({ cwd }: { cwd: string }) {
  const theme = useTheme();
  const width = WORDMARK[0].length;
  const cycle = width + SHINE_WIDTH + SHINE_REST;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), FRAME_MS);
    return () => clearInterval(timer);
  }, []);

  const phase = tick % cycle;
  const sweep = Math.floor(tick / cycle);
  const start = phase - SHINE_WIDTH;

  // The pet blinks just as the light finishes crossing the wordmark — the sweep
  // arrives, the cat reacts. Tying the two together is what makes the banner
  // read as one animation instead of two things twitching near each other.
  const blinkAt = width + SHINE_WIDTH;
  const blinking = phase >= blinkAt && phase < blinkAt + BLINK_FRAMES;
  const mood: PetMood = blinking ? (sweep % WINK_EVERY === 0 ? "wink" : "blink") : "open";
  const petLines = pet(mood);

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1} paddingLeft={1}>
      <Box>
        <Box flexDirection="column">
          {WORDMARK.map((line, i) => (
            <Text key={i}>
              <Text color={theme.primary}>{clampSlice(line, 0, start)}</Text>
              <Text color={theme.accent}>{clampSlice(line, start, start + SHINE_EDGE)}</Text>
              <Text color={theme.text} bold>
                {clampSlice(line, start + SHINE_EDGE, start + SHINE_WIDTH - SHINE_EDGE)}
              </Text>
              <Text color={theme.accent}>
                {clampSlice(line, start + SHINE_WIDTH - SHINE_EDGE, start + SHINE_WIDTH)}
              </Text>
              <Text color={theme.primary}>{clampSlice(line, start + SHINE_WIDTH, line.length)}</Text>
            </Text>
          ))}
        </Box>

        <Box flexDirection="column" marginLeft={2}>
          {petLines.map((line, i) => (
            <Text key={i} color={theme.muted}>
              {line}
            </Text>
          ))}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.muted}>{TAGLINE}</Text>
        <Text color={theme.faint}>{`  ·  v${VERSION}`}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.faint}>
          <Text color={theme.text} bold>
            /
          </Text>
          {" commands   "}
          <Text color={theme.text} bold>
            @
          </Text>
          {" mention files   "}
          <Text color={theme.text} bold>
            Tab
          </Text>
          {" plan mode"}
        </Text>
        <Text color={theme.faint}>{tildify(cwd)}</Text>
      </Box>
    </Box>
  );
}
