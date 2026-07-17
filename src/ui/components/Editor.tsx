import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
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
};


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

export function Editor({ mode, cwd, skills, busy, onSubmit, onPalette, onToggleMode }: EditorProps) {
  const theme = useTheme();
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState(0);
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
  const active = Math.min(selected, Math.max(0, suggestions.length - 1));

  // Scroll window for the suggestion list, kept centered on the highlight.
  const windowStart =
    suggestions.length <= VISIBLE_SUGGESTIONS
      ? 0
      : Math.max(
          0,
          Math.min(active - Math.floor(VISIBLE_SUGGESTIONS / 2), suggestions.length - VISIBLE_SUGGESTIONS),
        );
  const windowEnd = Math.min(suggestions.length, windowStart + VISIBLE_SUGGESTIONS);

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
    onSubmit(value);
  }

  function insert(chunk: string) {
    setText((t) => t.slice(0, cursor) + chunk + t.slice(cursor));
    setCursor((c) => c + chunk.length);
    setSelected(0);
  }

  useInput(
    (input, key) => {
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
        if (text) reset();
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
    { isActive: !busy },
  );

  const lines = text.split("\n");
  const placeholder = mode === "plan" ? "Ask what would change…" : "Type a command…";

  const hints: Hint[] = open
    ? [
        { key: "↑↓", action: "move" },
        { key: "Enter", action: "accept" },
        { key: "Esc", action: "dismiss" },
      ]
    : [
        { key: "Enter", action: "send" },
        { key: "Tab", action: mode === "plan" ? "build mode" : "plan mode" },
        { key: "/", action: "commands" },
        { key: "@", action: "files" },
        { key: newlineKeyLabel(), action: "newline" },
      ];

  return (
    <Box flexDirection="column">
      <Box
        borderStyle="round"
        borderColor={theme.border}
        paddingX={1}
        flexDirection="column"
      >
        <Box>
          <Text color={mode === "plan" ? theme.accent : theme.primary} bold>
            {"❯ "}
          </Text>
          <Box flexDirection="column" flexGrow={1}>
            {text === "" ? (
              <Text color={theme.faint}>{placeholder}</Text>
            ) : (
              lines.map((line, i) => (
                <Text key={i} color={theme.text}>
                  {line || " "}
                </Text>
              ))
            )}
          </Box>
        </Box>
      </Box>

      {open && (
        <Box flexDirection="column" marginTop={1}>
          {windowStart > 0 && <Text color={theme.faint}>{`  ↑ ${windowStart} more`}</Text>}
          {suggestions.slice(windowStart, windowStart + VISIBLE_SUGGESTIONS).map((label, i) => {
            const real = windowStart + i;
            const entry: PaletteEntry | undefined = paletteEntries[real];
            const isActive = real === active;
            return (
              <Box key={label}>
                <Text color={isActive ? theme.primary : theme.faint}>{isActive ? "❯ " : "  "}</Text>
                <Box width={16}>
                  <Text color={isActive ? theme.text : theme.muted} bold={isActive}>
                    {label}
                  </Text>
                </Box>
                {entry && (
                  <Text color={theme.faint}>
                    {entry.kind === "skill" ? "skill · " : ""}
                    {entry.description}
                  </Text>
                )}
              </Box>
            );
          })}
          {windowEnd < suggestions.length && (
            <Text color={theme.faint}>{`  ↓ ${suggestions.length - windowEnd} more`}</Text>
          )}
        </Box>
      )}

      <Hints hints={hints} />
    </Box>
  );
}
