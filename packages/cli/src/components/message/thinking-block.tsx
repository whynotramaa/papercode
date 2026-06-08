import { useTheme } from "../../providers/theme";
import { useEffect, useState } from "react";

const SPIN_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

type Props = {
  content: string;
  isDone: boolean;
  elapsedS?: number;
};

export function ThinkingBlock({ content, isDone, elapsedS }: Props) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [spinFrame, setSpinFrame] = useState(0);

  useEffect(() => {
    if (isDone) return;
    const id = setInterval(() => setSpinFrame(f => (f + 1) % SPIN_FRAMES.length), 80);
    return () => clearInterval(id);
  }, [isDone]);

  const lines = content.split("\n");

  if (!isDone) {
    const preview = lines.filter(l => l.trim()).slice(-3);
    return (
      <box flexDirection="column" paddingLeft={4} gap={0} marginBottom={1}>
        <box flexDirection="row" gap={1}>
          <text fg={colors.thinking}>{SPIN_FRAMES[spinFrame]}</text>
          <text fg={colors.dim}>thinking...</text>
        </box>
        {preview.map((line, i) => (
          <text key={i} fg={colors.dim}>{"  "}{line}</text>
        ))}
      </box>
    );
  }

  const label = elapsedS ? `thought for ${elapsedS}s` : "thought";

  return (
    <box flexDirection="column" paddingLeft={4} gap={0} marginBottom={1}>
      <box flexDirection="row" gap={1} onMouseDown={() => setExpanded(e => !e)}>
        <text fg={colors.dim}>{expanded ? "▼" : "▶"}</text>
        <text fg={colors.dim}>{label}</text>
      </box>
      {expanded && (
        <box flexDirection="column" gap={0} paddingLeft={2} marginTop={0}>
          {lines.map((line, i) => (
            <text key={i} fg={colors.dim}>{line || " "}</text>
          ))}
        </box>
      )}
    </box>
  );
}
