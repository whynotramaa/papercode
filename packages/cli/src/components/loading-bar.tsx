import { useEffect, useState } from "react";

import { useTheme } from "../providers/theme";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function LoadingBar() {
  const { colors } = useTheme();
  const [frame, setFrame] = useState(0);
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, 80);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d + 1) % 4);
    }, 500);
    return () => clearInterval(id);
  }, []);

  const dotsStr = ".".repeat(dots).padEnd(3, " ");

  return (
    <box flexDirection="row" alignItems="center" gap={1}>
      <text fg={colors.primary}>{FRAMES[frame]}</text>
      <text fg={colors.dim}>Thinking{dotsStr}</text>
    </box>
  );
}
