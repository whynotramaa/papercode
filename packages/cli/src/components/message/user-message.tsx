import { useTheme } from "../../providers/theme";

type Props = {
  message: string;
}

export function UserMessage({ message }: Props) {
  const { colors } = useTheme()
  return (
    <box width="100%" flexDirection="row" gap={2} alignItems="flex-start" paddingBottom={1}>
      <text fg={colors.primary}>›</text>
      <text>{message}</text>
    </box>
  )
}
