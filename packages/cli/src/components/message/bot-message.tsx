import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../providers/theme";
import { useEffect, useState } from "react";

type Props = {
  content: string;
  model: string;
}

function useFadeIn() {
  const [faded, setFaded] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setFaded(false), 120)
    return () => clearTimeout(id)
  }, [])
  return faded
}

export function BotMessage({ content, model }: Props) {
  const { colors } = useTheme()
  const faded = useFadeIn()

  return (
    <box flexDirection="column" width="100%" gap={1}>
      <box paddingLeft={4} width="100%">
        <text attributes={faded ? TextAttributes.DIM : undefined}>{content}</text>
      </box>
      <box flexDirection="row" gap={1} alignItems="center" paddingLeft={4}>
        <text fg={colors.primary} attributes={TextAttributes.DIM}>◆</text>
        <text attributes={TextAttributes.DIM}>{model}</text>
      </box>
    </box>
  )
}
