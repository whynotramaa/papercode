import { TextAttributes } from "@opentui/core";
import { DEFAULT_CHAT_MODEL_ID } from "@papercode/shared";
import { useAuth } from "../providers/auth";
import { useModel } from "../providers/model";
import { useTheme } from "../providers/theme";

export function StatusBar() {
  const { colors } = useTheme()
  const { selectedModel } = useModel()
  const { isSetup } = useAuth()

  let rightContent: { text: string; dim?: boolean; fg?: string }
  if (!isSetup) {
    rightContent = { text: "github: @whynotramaa", dim: true }
  } else if (selectedModel === DEFAULT_CHAT_MODEL_ID) {
    rightContent = { text: "select a model", dim: true, fg: colors.primary }
  } else {
    rightContent = { text: selectedModel }
  }

  return (
    <box flexDirection="row" gap={1} alignItems="center">
      <text fg={colors.primary}>Build</text>
      <text attributes={TextAttributes.DIM} fg={colors.dimSeperator}>›</text>
      <text
        fg={rightContent.fg}
        attributes={rightContent.dim ? TextAttributes.DIM : undefined}
      >
        {rightContent.text}
      </text>
    </box>
  );
}
