import React from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../themes/context.js";
import { COMMANDS } from "../commands.js";
import { supportsKittyKeyboard } from "../keyboard.js";
import { Panel } from "../components/Panel.js";
import { Hints } from "../components/Hints.js";
import { VERSION } from "../brand.js";

const SHORTCUTS: [string, string][] = [
  ["Enter", "send message"],
  ["Shift+Enter", "newline (kitty-capable terminals)"],
  ["Ctrl+J", "newline (everywhere)"],
  ["Tab", "toggle build / plan"],
  ["Esc", "clear input, or interrupt a response"],
  ["Ctrl+Y", "copy the last response"],
  ["Ctrl+T", "show / hide thinking blocks"],
  ["@", "file mention"],
  ["/", "command palette"],
  ["↑ ↓", "history, or move through a list"],
  ["Ctrl+C", "quit"],
];

export function Help({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  useInput(() => onClose());

  return (
    <Panel title="Help" corner={`papercode v${VERSION}`}>
      <Text color={theme.muted} bold>
        Commands
      </Text>
      <Box flexDirection="column" marginTop={1} marginBottom={1}>
        {COMMANDS.map((c) => (
          <Box key={c.name}>
            <Box width={14}>
              <Text color={theme.primary}>/{c.name}</Text>
            </Box>
            <Text color={theme.faint}>{c.description}</Text>
          </Box>
        ))}
      </Box>

      <Text color={theme.muted} bold>
        Keyboard
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {SHORTCUTS.map(([key, desc]) => (
          <Box key={key}>
            <Box width={14}>
              <Text color={theme.text} bold>
                {key}
              </Text>
            </Box>
            <Text color={theme.faint}>{desc}</Text>
          </Box>
        ))}
      </Box>

      {!supportsKittyKeyboard() && (
        <Box marginTop={1}>
          <Text color={theme.warning}>
            This terminal cannot report Shift+Enter distinctly — use Ctrl+J for a newline.
          </Text>
        </Box>
      )}

      <Hints hints={[{ key: "any key", action: "close" }]} />
    </Panel>
  );
}
