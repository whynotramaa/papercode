import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../themes/context.js";
import { Hints } from "./Hints.js";

export type TextPromptProps = {
  label: string;
  hint?: string;
  initialValue?: string;
  
  mask?: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  validate?: (value: string) => string | undefined;
};

export function TextPrompt({ label, hint, initialValue = "", mask, onSubmit, onCancel, validate }: TextPromptProps) {
  const theme = useTheme();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | undefined>();

  useInput((input, key) => {
    if (key.escape) {
      if (value) {
        setValue("");
        setError(undefined);
        return;
      }
      return onCancel();
    }

    if (key.return) {
      const problem = validate?.(value);
      if (problem) return setError(problem);
      return onSubmit(value);
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      setError(undefined);
      return;
    }

    if (key.ctrl && input === "u") {
      setValue("");
      return;
    }

    // Paste arrives as one multi-character chunk; take it whole rather than
    // filtering to single keypresses, or long API keys arrive truncated.
    if (input && !key.ctrl && !key.meta && !key.tab) {
      setValue((v) => v + input);
      setError(undefined);
    }
  });

  const shown = mask ? "•".repeat(Math.min(value.length, 48)) : value;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={theme.text}>{label}</Text>
      {hint && <Text color={theme.faint}>{hint}</Text>}

      <Box
        marginTop={1}
        borderStyle="round"
        borderColor={error ? theme.error : theme.border}
        paddingX={1}
      >
        <Text color={theme.primary} bold>
          {"❯ "}
        </Text>
        <Text color={theme.text}>{shown}</Text>
        <Text color={theme.primary}>▌</Text>
      </Box>

      {error && <Text color={theme.error}>{error}</Text>}

      <Hints
        hints={[
          { key: "Enter", action: "confirm" },
          { key: "Esc", action: value ? "clear" : "cancel" },
        ]}
      />
    </Box>
  );
}
