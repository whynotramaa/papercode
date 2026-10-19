import React from "react";
import path from "node:path";
import { Box, Text } from "ink";
import { useTheme } from "../themes/context.js";
import { compactCount, meter, tildify } from "./Header.js";
import { textOf, type ChatMessage } from "../../agent/messages.js";
import { SUMMARY_MARKER } from "../../agent/compact.js";
import type { HistoryMeta } from "../../agent/history.js";

export function changedFiles(messages: ChatMessage[]): string[] {
  const paths = new Set<string>();
  const results = new Map(messages.filter((m) => m.role === "tool").map((m) => [m.tool_call_id, m]));
  for (const message of messages) {
    const block = message.role === "user" && textOf(message).startsWith(SUMMARY_MARKER)
      ? textOf(message).match(/<modified-files>([\s\S]*?)<\/modified-files>/)?.[1] : undefined;
    if (block) for (const file of block.split("\n")) if (file.trim()) paths.add(file.trim());
    if (message.role !== "assistant") continue;
    for (const call of message.tool_calls ?? []) {
      if (call.type !== "function" || !["edit", "write"].includes(call.function.name)) continue;
      const result = results.get(call.id) as (ChatMessage & HistoryMeta) | undefined;
      if (!result || result._isError) continue;
      try {
        const args = JSON.parse(call.function.arguments);
        if (typeof args.path === "string") paths.add(args.path);
      } catch {}
    }
  }
  return [...paths];
}

type Props = {
  cwd: string; title: string; model?: string; provider?: string; tokens: number; contextLimit: number;
  cost: number; cacheRate?: number; thinking: string; skills: number; servers: number; mcpErrors: number;
  tools: number; messages: ChatMessage[]; compact: boolean; queued: number;
};

export function ContextPanel(props: Props) {
  const theme = useTheme();
  const fraction = Math.min(1, props.tokens / props.contextLimit);
  const files = changedFiles(props.messages);
  const heading = (text: string) => <Text color={theme.text} bold>{text}</Text>;
  return (
    <Box width={29} flexShrink={0} paddingX={2} paddingTop={1} flexDirection="column" borderStyle="single" borderColor={theme.border} borderTop={false} borderBottom={false} borderRight={false} overflow="hidden">
      {heading("Session")}
      <Text color={theme.muted} wrap="truncate-end">{props.title}</Text>
      <Box marginTop={1} flexDirection="column">
        {heading("Context")}
        <Text color={fraction > 0.8 ? theme.warning : theme.primary}>{meter(fraction, 22)}</Text>
        <Text color={theme.muted}>{`${Math.round(fraction * 100)}% used · ${compactCount(props.tokens)} / ${compactCount(props.contextLimit)}`}</Text>
        <Text color={theme.faint}>{`$${props.cost.toFixed(2)} session cost`}</Text>
        {props.cacheRate !== undefined && <Text color={theme.faint}>{`${Math.round(props.cacheRate * 100)}% prompt cache hit`}</Text>}
      </Box>
      <Box marginTop={1} flexDirection="column">
        {heading("Model")}
        <Text color={theme.accent} wrap="truncate-middle">{props.model ?? "Not connected"}</Text>
        <Text color={theme.muted} wrap="truncate-end">{props.provider ?? "Use /connect to start"}</Text>
        <Text color={theme.faint}>{`Thinking ${props.thinking}`}</Text>
      </Box>
      {!props.compact && <Box marginTop={1} flexDirection="column">
        {heading("Workspace")}
        <Text color={theme.muted} wrap="truncate-middle">{tildify(props.cwd)}</Text>
        <Text color={theme.faint}>{`${props.tools} tools · ${props.skills} skills`}</Text>
        <Text color={props.mcpErrors ? theme.warning : theme.faint}>{`${props.servers} MCP servers${props.mcpErrors ? ` · ${props.mcpErrors} errors` : ""}`}</Text>
      </Box>}
      <Box marginTop={1} flexDirection="column">
        {heading(`Changed files${files.length ? ` · ${files.length}` : ""}`)}
        {files.length ? files.slice(- (props.compact ? 2 : 5)).map((file) => (
          <Text key={file} color={theme.success} wrap="truncate-middle">{path.relative(props.cwd, path.resolve(props.cwd, file))}</Text>
        )) : <Text color={theme.faint}>No file changes yet</Text>}
        {files.length > (props.compact ? 2 : 5) && <Text color={theme.faint}>+{files.length - (props.compact ? 2 : 5)} more</Text>}
      </Box>
      {props.queued > 0 && <Box marginTop={1}><Text color={theme.primary}>{props.queued} messages queued</Text></Box>}
      <Box flexGrow={1} />
      <Box paddingY={1} flexDirection="column">
        <Text color={theme.faint}>ctrl+b   hide context</Text>
      </Box>
    </Box>
  );
}
