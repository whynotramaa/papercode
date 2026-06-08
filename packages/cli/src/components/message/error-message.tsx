import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../providers/theme";
import { useEffect, useState } from "react";

type Props = {
  message: string;
}

function useFadeIn() {
  const [faded, setFaded] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setFaded(false), 120)
    return () => clearTimeout(id)
  }, [])
  return faded
}

export function ErrorMessage({ message }: Props) {
  const { colors } = useTheme()
  const faded = useFadeIn()

  return (
    <box flexDirection="column" width="100%" gap={1}>
      <box flexDirection="row" gap={1} alignItems="center">
        <text fg={colors.error}>✕</text>
        <text fg={colors.error}>error</text>
      </box>
      <box paddingLeft={4} width="100%">
        <text fg={colors.foreground} attributes={faded ? TextAttributes.DIM : undefined}>{message}</text>
      </box>
    </box>
  )
}
