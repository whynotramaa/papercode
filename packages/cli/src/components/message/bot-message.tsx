import { TextAttributes } from "@opentui/core";
import { execFile } from "node:child_process";
import { useTheme } from "../../providers/theme";
import { useCallback, useEffect, useState } from "react";
import { EmptyBorder } from "../border";
import { ToolCallBlock, type ToolCallState } from "./tool-call-block";
import { MarkdownRenderer } from "./markdown-renderer";
import { ThinkingBlock } from "./thinking-block";

const THINK_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

type Props = {
  content: string;
  model: string;
  toolCalls?: ToolCallState[];
  isStreaming?: boolean;
  thinking?: string;
  thinkingDone?: boolean;
  thinkingElapsedS?: number;
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

export function BotMessage({ content, model, toolCalls, isStreaming = false, thinking, thinkingDone, thinkingElapsedS }: Props) {
  const { colors } = useTheme()
  const faded = useFadeIn()
  const [copied, setCopied] = useState(false)
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!isStreaming) return
    const id = setInterval(() => setFrame(f => (f + 1) % THINK_FRAMES.length), 80)
    return () => clearInterval(id)
  }, [isStreaming])

  const handleCopy = useCallback(() => {
    copyToClipboard(content, () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }, [content])

  // check if any tool is actively running (distinct from overall stream)
  const hasRunningTool = toolCalls?.some(tc => tc.status === "running") ?? false
  // label shown next to the spinner while streaming
  const streamLabel = hasRunningTool ? "" : "thinking"

  return (
    <box flexDirection="column" width="100%" gap={1}>
      <box
        width="100%"
        border={["top"]}
        borderColor={colors.dimSeperator}
        customBorderChars={{ ...EmptyBorder, horizontal: "─", topLeft: "─", topRight: "─" }}
      />

      {thinking && (
        <ThinkingBlock
          content={thinking}
          isDone={thinkingDone ?? false}
          elapsedS={thinkingElapsedS}
        />
      )}

      {toolCalls && toolCalls.length > 0 && (
        <box flexDirection="column" gap={0}>
          {toolCalls.map(tc => <ToolCallBlock key={tc.toolCallId} {...tc} />)}
        </box>
      )}

      {content && (
        <MarkdownRenderer content={content} isStreaming={isStreaming} />
      )}

      {/* footer: spinner + model while streaming, static model + copy after done */}
      <box flexDirection="row" gap={1} alignItems="center" paddingLeft={4}>
        {isStreaming ? (
          <>
            <text fg={colors.thinking}>{THINK_FRAMES[frame]}</text>
            <text fg={colors.dim}>{model}</text>
            {streamLabel && (
              <text fg={colors.dim}>· {streamLabel}</text>
            )}
          </>
        ) : (
          <>
            <text fg={colors.primary}>◆</text>
            <text fg={colors.dim}>{model}</text>
            <text fg={colors.dim}>·</text>
            <box onMouseDown={handleCopy}>
              <text fg={copied ? colors.success : colors.dim}>
                {copied ? "copied!" : "copy"}
              </text>
            </box>
          </>
        )}
      </box>
    </box>
  )
}
