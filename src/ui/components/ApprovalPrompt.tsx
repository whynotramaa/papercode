import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../themes/context.js";
import { Hints } from "./Hints.js";
import type { AnyTool } from "../../tools/index.js";

export type ApprovalRequest = {
  tool: AnyTool;
  args: unknown;
  preview: string;
  target?: string;
  resolve: (choice: ApprovalChoice) => void;
};

export type ApprovalChoice = "once" | "always" | "deny";

const OPTIONS: { choice: ApprovalChoice; label: string }[] = [
  { choice: "once", label: "Yes, once" },
  { choice: "always", label: "Yes, and don't ask again this session" },
  { choice: "deny", label: "No" },
];

export function ApprovalPrompt({ request }: { request: ApprovalRequest }) {
  const theme = useTheme();
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) return setSelected((s) => (s - 1 + OPTIONS.length) % OPTIONS.length);
    if (key.downArrow) return setSelected((s) => (s + 1) % OPTIONS.length);

    // Esc is "no" everywhere else in the app; making it deny here keeps that
    // meaning rather than leaving the prompt hanging.
    if (key.escape) return request.resolve("deny");
    if (key.return) return request.resolve(OPTIONS[selected]?.choice ?? "deny");

    const n = Number.parseInt(input, 10);
    if (n >= 1 && n <= OPTIONS.length) return request.resolve(OPTIONS[n - 1]!.choice);
  });

  const danger = request.tool.permission === "dangerous";

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={danger ? theme.warning : theme.primary} bold>
          {danger ? "run" : request.tool.name}
        </Text>
        <Text color={theme.muted}>{"  "}{danger ? "wants to run a command" : "wants to change a file"}</Text>
      </Box>

      <Box
        marginTop={1}
        borderStyle="round"
        borderColor={danger ? theme.warning : theme.border}
        paddingX={1}
      >
        <Text color={theme.code}>{request.preview}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {OPTIONS.map((opt, i) => (
          <Box key={opt.choice}>
            <Text color={i === selected ? theme.primary : theme.faint}>{i === selected ? "❯ " : "  "}</Text>
            <Text color={i === selected ? theme.text : theme.muted} bold={i === selected}>
              {i + 1}. {opt.label}
            </Text>
          </Box>
        ))}
      </Box>

      <Hints
        hints={[
          { key: "↑↓", action: "move" },
          { key: "Enter", action: "confirm" },
          { key: "1-3", action: "pick" },
          { key: "Esc", action: "deny" },
        ]}
      />
    </Box>
  );
}
