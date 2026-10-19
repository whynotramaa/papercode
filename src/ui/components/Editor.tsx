import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import chalk from "chalk";
import wrapAnsi from "wrap-ansi";
import { useViewport } from "../useViewport.js";
import { useTheme } from "../themes/context.js";
import { useFileSuggestions } from "./useFileSuggestions.js";
import { filterPalette, type PaletteEntry } from "../commands.js";
import { Hints, type Hint } from "./Hints.js";
import { newlineKeyLabel } from "../keyboard.js";
import type { Skill } from "../../config/skills.js";
import type { Mode } from "../../tools/permissions.js";

export type EditorProps = {
  mode: Mode;
  cwd: string;
  skills: Skill[];
  busy: boolean;
  onSubmit: (text: string) => void;
  onPalette: (entry: PaletteEntry) => void;
  onToggleMode: () => void;
  initialText?: string;
  width?: number;
  onSuggestionsChange?: (open: boolean) => void;
};

const PASTE_LINES = 10;


export function paletteQuery(text: string, cursor: number): string | null {
  // Only when the slash opens the buffer: "what does /foo do?" is prose, not a command.
  if (!text.startsWith("/")) return null;
  const upToCursor = text.slice(0, cursor);
  if (upToCursor.includes(" ") || upToCursor.includes("\n")) return null;
  return text.slice(1, cursor);
}


export function mentionQuery(text: string, cursor: number): string | null {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  // Must start a word, and must not have whitespace between @ and the cursor.
  const prev = at > 0 ? before[at - 1] : " ";
  if (prev !== undefined && !/\s/.test(prev)) return null;
  const fragment = before.slice(at + 1);
  if (/\s/.test(fragment)) return null;
  return fragment;
}


const VISIBLE_SUGGESTIONS = 8;

export function Editor({ mode, cwd, skills, busy, onSubmit, onPalette, onToggleMode, initialText = "", width, onSuggestionsChange }: EditorProps) {
  const theme = useTheme();
  const { columns, rows } = useViewport();
  const capacity = Math.min(6, Math.max(2, rows - 17));
  const [text, setText] = useState(initialText);
  const [cursor, setCursor] = useState(initialText.length);
  const pastes = useRef(new Map<string, string>());
  const [selected, setSelected] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  const pQuery = paletteQuery(text, cursor);
  const mQuery = pQuery === null ? mentionQuery(text, cursor) : null;

  const paletteEntries = useMemo(
    () => (pQuery === null ? [] : filterPalette(pQuery, skills)),
    [pQuery, skills],
  );
  const fileMatches = useFileSuggestions(cwd, mQuery).slice(0, VISIBLE_SUGGESTIONS);

  const suggestions: string[] = pQuery !== null ? paletteEntries.map((e) => e.label) : fileMatches;
  const open = suggestions.length > 0;
  useEffect(() => { onSuggestionsChange?.(open); }, [open, onSuggestionsChange]);
  const active = Math.min(selected, Math.max(0, suggestions.length - 1));

  // Scroll window for the suggestion list, kept centered on the highlight.
  const windowStart =
    suggestions.length <= capacity
      ? 0
      : Math.max(
          0,
          Math.min(active - Math.floor(capacity / 2), suggestions.length - capacity),
        );

  function reset() {
    setText("");
    setCursor(0);
    setSelected(0);
    setHistoryIndex(null);
  }

  function acceptSuggestion() {
    if (pQuery !== null) {
      const entry = paletteEntries[active];
      if (entry) {
        reset();
        onPalette(entry);
      }
      return;
    }

    const file = fileMatches[active];
    if (file === undefined) return;
    const before = text.slice(0, cursor);
    const at = before.lastIndexOf("@");
    const next = `${text.slice(0, at)}@${file} ${text.slice(cursor)}`;
    setText(next);
    setCursor(at + file.length + 2);
    setSelected(0);
  }

  function submit() {
    const value = text.trim();
    if (!value) return;
    setHistory((h) => [value, ...h.filter((x) => x !== value)].slice(0, 100));
    reset();
    let expanded = value;
    for (const [marker, content] of pastes.current) expanded = expanded.split(marker).join(content);
    pastes.current.clear();
    onSubmit(expanded);
  }

  function insert(raw: string) {
    let chunk = raw.replace(/\r\n?/g, "\n");
    const lineCount = chunk.split("\n").length;
    if (lineCount >= PASTE_LINES) {
      const marker = `[Pasted #${pastes.current.size + 1} +${lineCount} lines]`;
      pastes.current.set(marker, chunk);
      chunk = marker;
    }
    setText((t) => t.slice(0, cursor) + chunk + t.slice(cursor));
    setCursor((c) => c + chunk.length);
    setSelected(0);
  }

  useInput(
    (input, key) => {
      if (key.pageUp || key.pageDown || (key.ctrl && input === "b")) return;
      // Tab: accept a suggestion when the picker is open, otherwise toggle mode.
      if (key.tab) {
        if (open) acceptSuggestion();
        else onToggleMode();
        return;
      }

      if (key.upArrow) {
        if (open) {
          setSelected((s) => (s - 1 + suggestions.length) % suggestions.length);
          return;
        }
        // Recall history only from an untouched or history-derived buffer, so
        // arrowing up mid-edit doesn't silently discard what was typed.
        if (history.length > 0 && (text === "" || historyIndex !== null)) {
          const next = historyIndex === null ? 0 : Math.min(historyIndex + 1, history.length - 1);
          const entry = history[next] ?? "";
          setHistoryIndex(next);
          setText(entry);
          setCursor(entry.length);
        }
        return;
      }

      if (key.downArrow) {
        if (open) {
          setSelected((s) => (s + 1) % suggestions.length);
          return;
        }
        if (historyIndex !== null) {
          const next = historyIndex - 1;
          if (next < 0) {
            setHistoryIndex(null);
            setText("");
            setCursor(0);
          } else {
            const entry = history[next] ?? "";
            setHistoryIndex(next);
            setText(entry);
            setCursor(entry.length);
          }
        }
        return;
      }

      if (key.escape) {
        // Esc clears the input when there is something to clear; App handles it
        // as "interrupt" while a response is streaming.
        if (text && !busy) reset();
        return;
      }

      if (key.return) {
        // Shift+Enter is only distinguishable when the terminal supports the
        // kitty keyboard protocol; Ctrl+J is the portable fallback for a newline.
        if (key.shift || key.meta) insert("\n");
        else if (open) acceptSuggestion();
        else submit();
        return;
      }

      // Ctrl+J arrives as a raw line feed on terminals without kitty support.
      if (input === "\n" || (key.ctrl && input === "j")) {
        insert("\n");
        return;
      }

      if (key.leftArrow) return setCursor((c) => Math.max(0, c - 1));
      if (key.rightArrow) return setCursor((c) => Math.min(text.length, c + 1));

      if (key.backspace || key.delete) {
        if (cursor === 0) return;
        setText((t) => t.slice(0, cursor - 1) + t.slice(cursor));
        setCursor((c) => c - 1);
        setSelected(0);
        return;
      }

      if (key.ctrl) {
        switch (input) {
          case "a":
            return setCursor(0);
          case "e":
            return setCursor(text.length);
          case "k":
            return setText((t) => t.slice(0, cursor));
          case "u":
            setText((t) => t.slice(cursor));
            return setCursor(0);
          case "w": {
            // Delete the word before the cursor, including the spaces up to it.
            const before = text.slice(0, cursor);
            const trimmed = before.replace(/\S*\s*$/, "");
            setText(trimmed + text.slice(cursor));
            setCursor(trimmed.length);
            return;
          }
          default:
            return;
        }
      }

      if (input && !key.meta) insert(input);
    },
  );

  const placeholder = mode === "plan" ? "Explore an idea or plan a change..." : "Describe a task. @ to add files, / for commands";
  const caret = "\x1b[7m";
  const painted = `${chalk.hex(theme.text)(text.slice(0, cursor))}${caret}${text[cursor] && text[cursor] !== "\n" ? text[cursor] : " "}\x1b[27m${chalk.hex(theme.text)(text.slice(cursor + (text[cursor] && text[cursor] !== "\n" ? 1 : 0)))}`;
  const wrapped = wrapAnsi(painted, Math.max(8, (width ?? columns) - 6), { hard: true, wordWrap: false, trim: false }).split("\n");
  const cursorLine = Math.max(0, wrapped.findIndex((line) => line.includes(caret)));
  const visibleLines = rows < 22 ? 2 : 4;
  const start = Math.max(0, cursorLine - visibleLines + 1);
  const lines = wrapped.slice(start, start + visibleLines);

  const hints: Hint[] = open
    ? [
        { key: "↑↓", action: "move" },
        { key: "Enter", action: "accept" },
        { key: "Esc", action: "dismiss" },
      ]
    : busy
    ? [
        { key: "Enter", action: "queue" },
        { key: "Esc", action: "interrupt" },
      ]
    : [
        { key: "Enter", action: "send" },
        { key: "/", action: "commands" },
        { key: newlineKeyLabel(), action: "newline" },
      ];

  return (
    <Box flexDirection="column" flexShrink={0}>
      <Box borderStyle="single" borderColor={theme.border} borderTopColor={mode === "plan" ? theme.accent : theme.primary} paddingX={1} flexDirection="column">
        <Box justifyContent="space-between" marginBottom={rows >= 22 ? 1 : 0}>
          <Text color={mode === "plan" ? theme.accent : theme.primary} bold>{busy ? "QUEUE A MESSAGE" : mode === "plan" ? "PLAN" : "BUILD"}</Text>
          {(width ?? columns) >= 44 && <Text color={theme.faint}>tab switch mode</Text>}
        </Box>
        <Box minHeight={rows >= 22 ? 2 : 1}>
          <Box width={2} flexShrink={0}><Text color={theme.primary}>{">"}</Text></Box>
          <Box flexDirection="column" flexGrow={1}>
            {text === "" ? <Text color={theme.faint} wrap="truncate-end"><Text inverse> </Text>{placeholder}</Text> : lines.map((line, i) => <Text key={i}>{line || " "}</Text>)}
          </Box>
        </Box>
        {wrapped.length > visibleLines && <Text color={theme.faint}>{start + 1}-{Math.min(start + visibleLines, wrapped.length)} of {wrapped.length} lines</Text>}
      </Box>
      {open && (
        <Box flexDirection="column" borderStyle="single" borderTop={false} borderColor={theme.border} paddingX={1}>
          <Text color={theme.faint}>{pQuery !== null ? "Commands" : "Files"}{` · ${active + 1}/${suggestions.length}`}</Text>
          {suggestions.slice(windowStart, windowStart + capacity).map((label, i) => {
            const real = windowStart + i;
            const entry = paletteEntries[real];
            const isActive = real === active;
            return (
              <Box key={label} height={1} flexShrink={0}>
                <Box width={2} flexShrink={0}><Text color={isActive ? theme.primary : theme.faint}>{isActive ? ">" : " "}</Text></Box>
                <Box width={entry ? Math.min(18, Math.floor((width ?? columns) * 0.4)) : Math.max(8, (width ?? columns) - 6)} marginRight={2} flexShrink={0}><Text color={isActive ? theme.text : theme.muted} bold={isActive} wrap="truncate-end">{label}</Text></Box>
                {entry && <Box flexGrow={1} minWidth={0}><Text color={theme.faint} wrap="truncate-end">{entry.description}</Text></Box>}
              </Box>
            );
          })}
        </Box>
      )}
      <Hints hints={hints} />
    </Box>
  );
}
