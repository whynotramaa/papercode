import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../themes/context.js";
import { renderMarkdown } from "../markdown.js";


export type Entry =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "thinking"; text: string; seconds: number }
  | { kind: "tool"; name: string; preview: string; result: string; isError: boolean }
  | { kind: "compaction"; summarized: number; before: number; after: number }
  | { kind: "notice"; text: string; tone: "info" | "success" | "error" };


const TOOL_RESULT_LINES = 6;

export function UserMessage({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Box marginY={1}>
      <Text color={theme.accent} bold>
        {"❯ "}
      </Text>
      <Text color={theme.text}>{text}</Text>
    </Box>
  );
}

export function AssistantMessage({ text }: { text: string }) {
  const theme = useTheme();
  if (!text.trim()) return null;
  return (
    <Box marginBottom={1} paddingLeft={2}>
      <Text>{renderMarkdown(text, theme)}</Text>
    </Box>
  );
}


export function StreamingMessage({ text }: { text: string }) {
  const theme = useTheme();
  if (!text) return null;
  return (
    <Box marginBottom={1} paddingLeft={2}>
      <Text color={theme.text}>{text}</Text>
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
    <Box marginBottom={1} marginLeft={2} paddingLeft={1} borderStyle="round" borderColor={theme.border}>
      <Text color={theme.faint} italic>
        {seconds > 0 ? `✻ Thought for ${seconds}s\n\n${text}` : text}
      </Text>
    </Box>
  );
}


export function ToolCall({
  name,
  preview,
  result,
  isError,
}: {
  name: string;
  preview: string;
  result: string;
  isError: boolean;
}) {
  const theme = useTheme();
  const lines = result.split("\n").filter((l, i, all) => !(l === "" && i === all.length - 1));
  const shown = lines.slice(0, TOOL_RESULT_LINES);
  const hidden = lines.length - shown.length;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={theme.faint}>{"  ⁘ "}</Text>
        <Box width={9}>
          <Text color={isError ? theme.error : theme.primary} bold>
            {name}
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text color={theme.muted}>{preview}</Text>
        </Box>
        <Text color={isError ? theme.error : theme.success}>{isError ? "✗ failed" : "✓ done"}</Text>
      </Box>
      {result.trim() && (
        <Box
          flexDirection="column"
          marginLeft={4}
          paddingX={1}
          borderStyle="round"
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
      <Box paddingLeft={3}>
        <Text color={theme.muted}>
          {summarized} {summarized === 1 ? "message" : "messages"} summarized
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


export function ResponseFooter({ thinkingShown }: { thinkingShown: boolean }) {
  const theme = useTheme();
  return (
    <Box paddingLeft={2} marginBottom={1}>
      <Text color={theme.faint}>
        <Text color={theme.muted}>ctrl+y</Text> copy{"   "}
        <Text color={theme.muted}>ctrl+t</Text> {thinkingShown ? "hide thinking" : "show thinking"}
      </Text>
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
      return <ToolCall name={entry.name} preview={entry.preview} result={entry.result} isError={entry.isError} />;
    case "compaction":
      return <CompactionReceipt summarized={entry.summarized} before={entry.before} after={entry.after} />;
    case "notice":
      return <Notice text={entry.text} tone={entry.tone} />;
  }
}
