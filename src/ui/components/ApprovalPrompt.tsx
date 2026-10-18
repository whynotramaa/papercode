import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../themes/context.js";
import { Hints } from "./Hints.js";
import { DiffView } from "./DiffView.js";
import type { Diff } from "../diff.js";
import type { AnyTool } from "../../tools/index.js";

export type ApprovalChoice = "once" | "always" | "deny";

export type ApprovalRequest = {
  tool: AnyTool;
  args: unknown;
  preview: string;
  target?: string;
  diff?: Diff;
  resolve: (choice: ApprovalChoice, reason?: string) => void;
};

export function ApprovalPrompt({ request }: { request: ApprovalRequest }) {
  const theme = useTheme();
  const [selected, setSelected] = useState(0);
  const [reason, setReason] = useState<string | null>(null);
  const danger = request.tool.permission === "dangerous";

  const options: { choice: ApprovalChoice; label: string }[] = [
    { choice: "once", label: "Yes" },
    { choice: "always", label: danger ? "Always allow this command" : "All edits this session" },
    { choice: "deny", label: "No, tell it why" },
  ];

  useInput((input, key) => {
    if (reason !== null) {
      if (key.escape) return request.resolve("deny");
      if (key.return) return request.resolve("deny", reason);
      if (key.backspace || key.delete) return setReason((r) => (r ?? "").slice(0, -1));
      if (input && !key.ctrl && !key.meta) setReason((r) => (r ?? "") + input);
      return;
    }

    const pick = (i: number) => {
      const choice = options[i]?.choice ?? "deny";
      if (choice === "deny") return setReason("");
      request.resolve(choice);
    };

    if (key.leftArrow || key.upArrow) return setSelected((s) => (s - 1 + options.length) % options.length);
    if (key.rightArrow || key.downArrow || key.tab) return setSelected((s) => (s + 1) % options.length);
    if (key.escape) return request.resolve("deny");
    if (key.return) return pick(selected);
    const n = Number.parseInt(input, 10);
    if (n >= 1 && n <= options.length) return pick(n - 1);
  });

  const diff = request.diff;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={danger ? theme.warning : theme.primary} bold>
          {danger ? "bash" : request.tool.name}
        </Text>
        <Text color={theme.muted}>{"  "}{diff ? diff.path : danger ? "wants to run a command" : request.preview}</Text>
        {diff && (
          <Text>
            {"  "}
            <Text color={theme.diffAdd}>+{diff.added}</Text> <Text color={theme.diffRemove}>−{diff.removed}</Text>
          </Text>
        )}
      </Box>

      <Box marginTop={1} borderStyle="round" borderColor={danger ? theme.warning : theme.border} paddingX={1}>
        {diff && diff.lines.length > 0 ? <DiffView diff={diff} /> : <Text color={theme.code}>{request.preview}</Text>}
      </Box>

      {reason === null ? (
        <Box marginTop={1}>
          <Text color={theme.text}>{danger ? "Run this command?" : "Apply this change?"}</Text>
          {options.map((opt, i) => (
            <Text key={opt.choice}>
              {"  "}
              <Text color={i === selected ? theme.primary : theme.faint}>{i === selected ? "› " : "  "}</Text>
              <Text color={i === selected ? theme.text : theme.muted} bold={i === selected}>
                {opt.label}
              </Text>
            </Text>
          ))}
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color={theme.text}>Tell it why: </Text>
          <Text color={theme.text}>{reason}</Text>
          <Text color={theme.primary}>▌</Text>
        </Box>
      )}

      <Hints
        hints={
          reason === null
            ? [
                { key: "←→", action: "move" },
                { key: "Enter", action: "confirm" },
                { key: "1-3", action: "pick" },
                { key: "Esc", action: "deny" },
              ]
            : [
                { key: "Enter", action: "deny with reason" },
                { key: "Esc", action: "deny" },
              ]
        }
      />
    </Box>
  );
}
