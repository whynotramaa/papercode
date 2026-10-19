import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../themes/context.js";
import { useElementWidth } from "../useViewport.js";
import { renderMarkdown } from "../markdown.js";


export type ToolItem = { name: string; preview: string; result: string; isError: boolean; display?: string };

export type Entry =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "thinking"; text: string; seconds: number }
  | ({ kind: "tool" } & ToolItem)
  | { kind: "tools"; items: ToolItem[] }
  | { kind: "compaction"; summarized: number; before: number; after: number }
  | { kind: "notice"; text: string; tone: "info" | "success" | "error" };


const TOOL_RESULT_LINES = 6;

export function UserMessage({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1} paddingX={1} borderStyle="single" borderColor={theme.border} borderTop={false} borderBottom={false} borderRight={false}>
      <Text color={theme.accent} bold>You</Text>
      <Text color={theme.text}>{text}</Text>
    </Box>
  );
}

export function AssistantMessage({ text }: { text: string }) {
  const theme = useTheme();
  if (!text.trim()) return null;
  return (
    <Box marginBottom={1} flexDirection="column">
      <Text color={theme.primary} bold>PaperCode</Text>
      <Text>{renderMarkdown(text, theme)}</Text>
    </Box>
  );
}


export function StreamingMessage({ text }: { text: string }) {
  const theme = useTheme();
  if (!text) return null;
  const fences = text.match(/^\s*```/gm)?.length ?? 0;
  return (
    <Box marginBottom={1} flexDirection="column">
      <Text color={theme.primary} bold>PaperCode</Text>
      <Text>{renderMarkdown(fences % 2 ? `${text}\n\`\`\`` : text, theme)}</Text>
    </Box>
  );
}

export function ThinkingBlock({
  text,
  seconds,
  collapsed,
}: {
  text: string;
  seconds: number;
  collapsed: boolean;
}) {
  const theme = useTheme();
  if (!text.trim()) return null;

  if (collapsed) {
    return (
      <Box marginBottom={1} paddingLeft={2}>
        <Text color={theme.faint}>
          ✻ Thought for {seconds}s <Text dimColor>· ctrl+t to show</Text>
        </Text>
      </Box>
    );
  }

  return (
    <Box marginBottom={1} marginLeft={2} paddingLeft={1} borderStyle="single" borderColor={theme.border}>
      <Text color={theme.faint} italic>
        {seconds > 0 ? `✻ Thought for ${seconds}s\n\n${text}` : text}
      </Text>
    </Box>
  );
}


export function ToolCall({ name, preview, result, isError, display, grouped }: ToolItem & { grouped?: boolean }) {
  const theme = useTheme();
  const { ref, width } = useElementWidth();
  const lines = result.split("\n").filter((l, i, all) => !(l === "" && i === all.length - 1));
  const shown = isError || name === "bash" ? lines.slice(-TOOL_RESULT_LINES) : lines.slice(0, TOOL_RESULT_LINES);
  const hidden = lines.length - shown.length;

  return (
    <Box ref={ref} flexDirection="column" marginBottom={grouped ? 0 : 1}>
      <Box height={1} flexShrink={0}>
        <Box width={2} flexShrink={0}><Text color={theme.faint}>{">"}</Text></Box>
        <Box width={Math.max(6, Math.min(16, Math.floor(width * 0.25)))} flexShrink={0} marginRight={1}>
          <Text color={isError ? theme.error : theme.primary} bold wrap="truncate-end">
            {name}
          </Text>
        </Box>
        <Box flexGrow={1} minWidth={0}>
          <Text color={theme.muted} wrap="truncate-end">{preview}</Text>
        </Box>
        <Box width={Math.max(8, Math.min(18, Math.floor(width * 0.3)))} flexShrink={0} marginLeft={1}>
          <Text color={isError ? theme.error : theme.muted} wrap="truncate-end">{isError ? "✗ failed" : display ?? "✓ done"}</Text>
        </Box>
      </Box>
      {result.trim() && (isError || name === "bash") && (
        <Box
          flexDirection="column"
          marginLeft={4}
          paddingX={1}
          borderStyle="single"
          borderColor={isError ? theme.error : theme.border}
        >
          {shown.map((line, i) => (
            <Text key={i} color={isError ? theme.error : theme.faint} wrap="truncate-end">
              {line || " "}
            </Text>
          ))}
          {hidden > 0 && (
            <Text color={theme.faint} dimColor>
              … +{hidden} {hidden === 1 ? "line" : "lines"}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}


export function CompactionReceipt({
  summarized,
  before,
  after,
}: {
  summarized: number;
  before: number;
  after: number;
}) {
  const theme = useTheme();
  const saved = before > 0 ? Math.round((1 - after / before) * 100) : 0;

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2}>
      <Box>
        {}
        <Box flexShrink={0}>
          <Text color={theme.accent}>{"⟩⟨ "}</Text>
          <Text color={theme.accent} bold>
            CONTEXT COMPACTED
          </Text>
        </Box>
        {}
        <Box
          flexGrow={1}
          marginLeft={1}
          borderStyle="single"
          borderColor={theme.border}
          borderTop={false}
          borderLeft={false}
          borderRight={false}
        />
      </Box>
      <Box paddingLeft={3} flexDirection="column">
        <Text color={theme.muted}>
          {summarized === 0
            ? "old tool output masked"
            : `${summarized} ${summarized === 1 ? "message" : "messages"} summarized`}
        </Text>
        <Text color={theme.faint}>
          {`  ~${before.toLocaleString()} → ~${after.toLocaleString()} tokens`}
        </Text>
        {saved > 0 && <Text color={theme.success}>{`  −${saved}%`}</Text>}
      </Box>
    </Box>
  );
}

export function Notice({ text, tone }: { text: string; tone: "info" | "success" | "error" }) {
  const theme = useTheme();
  const color = tone === "error" ? theme.error : tone === "success" ? theme.success : theme.faint;
  return (
    <Box marginBottom={1} paddingLeft={2}>
      <Text color={color}>{text}</Text>
    </Box>
  );
}


export function EntryView({ entry, showThinking }: { entry: Entry; showThinking?: boolean }) {
  switch (entry.kind) {
    case "user":
      return <UserMessage text={entry.text} />;
    case "assistant":
      return <AssistantMessage text={entry.text} />;
    case "thinking":
      return <ThinkingBlock text={entry.text} seconds={entry.seconds} collapsed={!showThinking} />;
    case "tool":
      return <ToolCall {...entry} />;
    case "tools":
      return (
        <Box flexDirection="column" marginBottom={1}>
          {entry.items.map((item, i) => (
            <ToolCall key={i} {...item} grouped />
          ))}
        </Box>
      );
    case "compaction":
      return <CompactionReceipt summarized={entry.summarized} before={entry.before} after={entry.after} />;
    case "notice":
      return <Notice text={entry.text} tone={entry.tone} />;
  }
}
