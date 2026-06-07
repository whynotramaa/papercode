import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../providers/theme";

type Props = {
  message: string;
}

export function UserMessage({ message }: Props) {
  const { colors } = useTheme()
  return (
    <box width="100%" flexDirection="row" gap={2} alignItems="flex-start">
      <text fg={colors.primary}>›</text>
      <text fg={colors.primary} attributes={TextAttributes.DIM}>&lt;user&gt;</text>
      <text>{message}</text>
    </box>
  )
}
