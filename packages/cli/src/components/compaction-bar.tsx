import { useEffect, useState } from "react";
import { useTheme } from "../providers/theme";

const PULSE_COLORS_KEYS = ["thinking", "primary"] as const;

type Props = {
  messageCount: number;
  reason: string;
};

export function CompactionBar({ messageCount, reason }: Props) {
  const { colors } = useTheme();
  const [dots, setDots] = useState(0);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d + 1) % 4);
    }, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setPulse((p) => (p + 1) % PULSE_COLORS_KEYS.length);
    }, 300);
    return () => clearInterval(id);
  }, []);

  const dotsStr = ".".repeat(dots).padEnd(3, " ");
  const pulseColor = colors[PULSE_COLORS_KEYS[pulse]];

  return (
    <box flexDirection="row" alignItems="center" gap={1}>
      <text fg={pulseColor}>⟡</text>
      <text fg={colors.thinking}>Compacting context{dotsStr}</text>
      <text fg={colors.dim}>{reason} · {messageCount} messages</text>
    </box>
  );
}
