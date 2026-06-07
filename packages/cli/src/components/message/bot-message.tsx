import { TextAttributes } from "@opentui/core";
import { execFile } from "node:child_process";
import { useTheme } from "../../providers/theme";
import { useCallback, useEffect, useState } from "react";
import { EmptyBorder } from "../border";

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

function copyToClipboard(text: string, onDone: () => void) {
  try {
    let cmd: string
    let args: string[]
    if (process.platform === "darwin") { cmd = "pbcopy"; args = [] }
    else if (process.platform === "win32") { cmd = "clip"; args = [] }
    else { cmd = "xclip"; args = ["-selection", "clipboard"] }
    const child = execFile(cmd, args, (err) => { if (!err) onDone() })
    child.stdin?.end(text, "utf8")
  } catch { /* silently fail */ }
}

export function BotMessage({ content, model }: Props) {
  const { colors } = useTheme()
  const faded = useFadeIn()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    copyToClipboard(content, () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }, [content])

  return (
    <box flexDirection="column" width="100%" gap={1}>
      <box
        width="100%"
        border={["top"]}
        borderColor={colors.dimSeperator}
        customBorderChars={{ ...EmptyBorder, horizontal: "─", topLeft: "─", topRight: "─" }}
      />
      <box paddingLeft={4} width="100%">
        <text attributes={faded ? TextAttributes.DIM : undefined}>{content}</text>
      </box>
      <box flexDirection="row" gap={1} alignItems="center" paddingLeft={4}>
        <text fg={colors.primary} attributes={TextAttributes.DIM}>◆</text>
        <text attributes={TextAttributes.DIM}>{model}</text>
        <text attributes={TextAttributes.DIM}>·</text>
        <box onMouseDown={handleCopy}>
          <text fg={copied ? colors.success : undefined} attributes={TextAttributes.DIM}>
            {copied ? "copied!" : "copy"}
          </text>
        </box>
      </box>
    </box>
  )
}
