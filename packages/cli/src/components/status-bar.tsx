
import { useAuth } from "../providers/auth";
import { useModel } from "../providers/model";
import { useTheme } from "../providers/theme";
import { useOptionalMode } from "../providers/mode";

export function StatusBar() {
  const { colors } = useTheme()
  const { selectedModel } = useModel()
  const { isSetup } = useAuth()
  const modeCtx = useOptionalMode()
  const mode = modeCtx?.mode ?? "BUILD"

  return (
    <box flexDirection="row" gap={1} alignItems="center">
      <text fg={mode === "BUILD" ? colors.primary : colors.planMode}>
        {mode === "BUILD" ? "Build" : "Plan"}
      </text>
      <text fg={colors.dim}>›</text>
      {isSetup ? (
        <text fg={colors.foreground}>{selectedModel}</text>
      ) : (
        <text fg={colors.dim}>@whynotramaa</text>
      )}
    </box>
  );
}
