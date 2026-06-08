import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../providers/theme";
import { useEffect, useRef, useState } from "react";
import { generateBlockDiff } from "../../lib/diff";
import type { ThemeColors } from "../../theme";

const MAX_DIFF_LINES = 25;

function renderDiffLines(diffStr: string, colors: ThemeColors): JSX.Element[] {
  const lines = diffStr.split("\n");
  let oldLine = 0;
  let newLine = 0;
  const rows: JSX.Element[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (rows.length >= MAX_DIFF_LINES) {
      rows.push(
        <box key="truncated" flexDirection="row" gap={0}>
          <text fg={colors.dim}>{"     "}… truncated</text>
        </box>
      );
      break;
    }
    const line = lines[i]!;
    if (line.startsWith("---") || line.startsWith("+++")) continue;

    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1]!, 10);
      newLine = parseInt(hunkMatch[2]!, 10);
      rows.push(
        <box key={i} flexDirection="row" gap={0}>
          <text fg={colors.dim}>{"     "}</text>
          <text fg={colors.info}>{line}</text>
        </box>
      );
      continue;
    }

    if (line.startsWith("+")) {
      const num = String(newLine).padStart(4, " ");
      rows.push(
        <box key={i} flexDirection="row" gap={0}>
          <text fg={colors.success}>{num} {"+"} {line.slice(1) || " "}</text>
        </box>
      );
      newLine++;
    } else if (line.startsWith("-")) {
      const num = String(oldLine).padStart(4, " ");
      rows.push(
        <box key={i} flexDirection="row" gap={0}>
          <text fg={colors.error}>{num} {"-"} {line.slice(1) || " "}</text>
        </box>
      );
      oldLine++;
    } else if (line.startsWith(" ")) {
      const num = String(oldLine).padStart(4, " ");
      rows.push(
        <box key={i} flexDirection="row" gap={0}>
          <text fg={colors.dim}>{num} {"  "} {line.slice(1) || " "}</text>
        </box>
      );
      oldLine++;
      newLine++;
    }
  }

  return rows;
}

// braille spinner for active work
const SPIN_FRAMES  = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
// slower pulse for read/list/search (feels different from bash/write)
const PULSE_FRAMES = ["·  ", "·· ", "···", " ··", "  ·", "   "];

export type ToolCallState = {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  status: "running" | "done" | "error"
  result?: string
}

type ToolCategory = "read" | "search" | "write" | "edit" | "shell" | "list"

function getCategory(toolName: string): ToolCategory {
  switch (toolName) {
    case "read_file":      return "read"
    case "grep":           return "search"
    case "glob":           return "search"
    case "list_directory": return "list"
    case "write_file":     return "write"
    case "edit_file":      return "edit"
    case "bash":           return "shell"
    default:               return "shell"
  }
}

function getIcon(toolName: string): string {
  switch (toolName) {
    case "read_file":      return "✱"
    case "grep":           return "⌕"
    case "glob":           return "✦"
    case "list_directory": return "⋉"
    case "write_file":     return "※"
    case "edit_file":      return "✎"
    case "bash":           return "⌬"
    default:               return "›"
  }
}

function getLabel(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case "read_file":      return `Reading  ${args.path}`
    case "grep":           return `Searching  "${args.pattern}"${args.path ? `  in ${args.path}` : ""}`
    case "glob":           return `Finding  ${args.pattern}`
    case "list_directory": return `Listing  ${args.path ?? "."}`
    case "write_file":     return `Writing  ${args.path}`
    case "edit_file":      return `Editing  ${args.path}`
    case "bash":           return `$  ${String(args.command ?? "").slice(0, 50)}`
    default:               return toolName
  }
}

function getResultSummary(toolName: string, result: string): string {
  if (!result || result === "(no matches)") return result ?? ""
  const lines = result.split("\n").filter(l => l.trim())
  switch (toolName) {
    case "read_file":      return `${lines.length} lines`
    case "list_directory": return `${lines.length} items`
    case "grep":           return `${lines.length} match${lines.length === 1 ? "" : "es"}`
    case "glob":           return `${lines.length} file${lines.length === 1 ? "" : "s"}`
    case "bash": {
      const firstLine = lines[0] ?? ""
      return firstLine.length > 50 ? firstLine.slice(0, 50) + "…" : firstLine
    }
    default: return ""
  }
}



function useElapsed(running: boolean): number {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    if (!running) return
    startRef.current = Date.now()
    setElapsed(0)
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  return elapsed
}

export function ToolCallBlock({ toolName, args, status, result }: ToolCallState) {
  const { colors } = useTheme()
  const category = getCategory(toolName)
  const isRunning = status === "running"

  // spinner frame — braille for shell/write/edit, pulse dots for read/search/list
  const [spinFrame, setSpinFrame]   = useState(0)
  const [pulseFrame, setPulseFrame] = useState(0)

  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => setSpinFrame(f => (f + 1) % SPIN_FRAMES.length), 80)
    return () => clearInterval(id)
  }, [isRunning])

  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => setPulseFrame(f => (f + 1) % PULSE_FRAMES.length), 200)
    return () => clearInterval(id)
  }, [isRunning])

  const elapsed = useElapsed(isRunning)

  const icon    = getIcon(toolName)
  const label   = getLabel(toolName, args)
  const summary = status !== "running" && result ? getResultSummary(toolName, result) : ""

  // build block-wise diff for all edit_file calls (args arrive with the tool call)
  const diffData = toolName === "edit_file" && typeof args.old_string === "string" && typeof args.new_string === "string"
    ? generateBlockDiff(
        String(args.path ?? "file"),
        args.old_string,
        args.new_string,
      )
    : null

  // Count added/removed lines for the header badge
  const diffCounts = diffData ? (() => {
    const lines = diffData.diffStr.split("\n")
    const added   = lines.filter(l => l.startsWith("+") && !l.startsWith("+++")).length
    const removed = lines.filter(l => l.startsWith("-") && !l.startsWith("---")).length
    return { added, removed }
  })() : null

  const useSpinner = category === "shell" || category === "write" || category === "edit"
  const animChar = isRunning
    ? (useSpinner ? SPIN_FRAMES[spinFrame] : PULSE_FRAMES[pulseFrame])
    : (status === "done" ? "✓" : "✕")

  const animColor = isRunning
    ? colors.thinking
    : (status === "done" ? colors.success : colors.error)

  const iconColor = isRunning ? colors.thinking : (status === "done" ? colors.success : colors.error)

  return (
    <box flexDirection="column" paddingLeft={4} gap={0}>
      {/* main row */}
      <box flexDirection="row" gap={1} alignItems="center">
        <text fg={animColor}>{animChar}</text>
        <text fg={iconColor}>{icon}</text>
        <text fg={colors.dim}>{label}</text>
        {isRunning && elapsed > 0 && (
          <text fg={colors.secondaryForeground}>  {elapsed}s</text>
        )}
        {!isRunning && summary && (
          <text fg={colors.secondaryForeground}>  {summary}</text>
        )}
        {!isRunning && !summary && result === "(no matches)" && (
          <text fg={colors.secondaryForeground}>  no matches</text>
        )}
        {status === "error" && result && (
          <text fg={colors.error}>
            {"  "}{result.split("\n")[0]?.slice(0, 60)}
          </text>
        )}
      </box>

      {/* Block-wise unified diff for edit_file */}
      {diffData && diffCounts && (
        <box
          flexDirection="column"
          marginTop={1}
          marginLeft={2}
          marginBottom={1}
        >
          {/* Diff header bar */}
          <box
            flexDirection="row"
            gap={1}
            alignItems="center"
            paddingX={1}
            backgroundColor={colors.surface}
            border={["top", "left", "right"]}
            borderColor={colors.dimSeperator}
          >
            <text fg={colors.info}>≡</text>
            <text fg={colors.dim}>
              {String(args.path ?? "file")}
            </text>
            <text fg={colors.secondaryForeground}>  </text>
            {diffCounts.added > 0 && (
              <text fg={colors.success} attributes={TextAttributes.BOLD}>+{diffCounts.added}</text>
            )}
            {diffCounts.removed > 0 && (
              <text fg={colors.error} attributes={TextAttributes.BOLD}>-{diffCounts.removed}</text>
            )}
          </box>
          {/* Diff body */}
          <box
            flexDirection="column"
            border={["bottom", "left", "right"]}
            borderColor={colors.dimSeperator}
            paddingX={1}
            gap={0}
          >
            {renderDiffLines(diffData.diffStr, colors)}
          </box>
        </box>
      )}

      {/* first line preview for write_file */}
      {status === "done" && toolName === "write_file" && result && !result.startsWith("Written:") && (
        <box paddingLeft={4}>
          <text fg={colors.success}>
            {result.split("\n")[0]?.slice(0, 60)}
          </text>
        </box>
      )}
    </box>
  )
}
