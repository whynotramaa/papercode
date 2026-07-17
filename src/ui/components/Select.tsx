import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../themes/context.js";
import { useViewport, listCapacity } from "../useViewport.js";
import { Hints, type Hint } from "./Hints.js";
import { Panel } from "./Panel.js";

export type SelectItem<T> = {
  value: T;
  label: string;
  
  detail?: string;
  
  badge?: string;
};

export type SelectProps<T> = {
  title: string;
  items: SelectItem<T>[];
  onSelect: (value: T) => void;
  onCancel: () => void;
  
  onDelete?: (value: T) => void;
  
  onHighlight?: (value: T) => void;
  hints?: Hint[];
  emptyMessage?: string;
};

const BASE_HINTS: Hint[] = [
  { key: "↑↓", action: "move" },
  { key: "Enter", action: "select" },
  { key: "type", action: "search" },
  { key: "Esc", action: "cancel" },
];


export function Select<T>({
  title,
  items,
  onSelect,
  onCancel,
  onDelete,
  onHighlight,
  hints,
  emptyMessage = "Nothing here yet.",
}: SelectProps<T>) {
  const theme = useTheme();
  const { rows } = useViewport();
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) => item.label.toLowerCase().includes(q) || item.detail?.toLowerCase().includes(q),
    );
  }, [items, query]);

  // Budget: panel borders, title, search row, hint bar, header above, and slack
  // so the frame never reaches the last row. A frame that exactly fills the
  // terminal still scrolls it by one line, which is all it takes for Ink to
  // lose track of what it has to erase and start stacking copies of the panel.
  const capacity = listCapacity(rows, 12);
  const active = Math.min(index, Math.max(0, filtered.length - 1));

  function move(next: number) {
    setIndex(next);
    const item = filtered[next];
    if (item && onHighlight) onHighlight(item.value);
  }

  useInput((input, key) => {
    if (key.escape) {
      if (query) {
        setQuery("");
        setIndex(0);
        return;
      }
      return onCancel();
    }

    if (key.upArrow) {
      if (filtered.length > 0) move((active - 1 + filtered.length) % filtered.length);
      return;
    }
    if (key.downArrow) {
      if (filtered.length > 0) move((active + 1) % filtered.length);
      return;
    }
    if (key.return) {
      const item = filtered[active];
      if (item) onSelect(item.value);
      return;
    }

    if (key.ctrl && input === "d" && onDelete) {
      const item = filtered[active];
      if (item) onDelete(item.value);
      return;
    }

    if (key.backspace || key.delete) {
      setQuery((q) => q.slice(0, -1));
      setIndex(0);
      return;
    }

    // Everything printable is search. Pastes arrive as one chunk; take it whole.
    if (input && !key.ctrl && !key.meta && !key.tab) {
      setQuery((q) => q + input);
      setIndex(0);
    }
  });

  // Keep the highlight inside the window as it moves past either edge.
  const half = Math.floor(capacity / 2);
  const start =
    filtered.length <= capacity ? 0 : Math.max(0, Math.min(active - half, filtered.length - capacity));
  const visible = filtered.slice(start, start + capacity);
  const above = start;
  const below = filtered.length - start - visible.length;

  const labelWidth = Math.min(28, Math.max(8, ...items.map((i) => i.label.length)));

  const counter =
    filtered.length === items.length
      ? `${filtered.length}`
      : `${filtered.length}/${items.length}`;

  return (
    <Panel title={title} corner={items.length > 0 ? counter : undefined}>
      <Box>
        <Text color={query ? theme.primary : theme.faint}>{"⌕ "}</Text>
        {query ? (
          <>
            <Text color={theme.text}>{query}</Text>
            <Text color={theme.primary}>▏</Text>
          </>
        ) : (
          <Text color={theme.faint}>type to search</Text>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {items.length === 0 ? (
          <Text color={theme.faint}>{emptyMessage}</Text>
        ) : filtered.length === 0 ? (
          <Text color={theme.faint}>No matches for “{query}”.</Text>
        ) : (
          <>
            {above > 0 && <Text color={theme.faint}>{`  ↑ ${above} more`}</Text>}
            {visible.map((item, i) => {
              const real = start + i;
              const isActive = real === active;
              return (
                <Box key={real}>
                  <Text color={isActive ? theme.primary : theme.faint}>{isActive ? "❯ " : "  "}</Text>
                  <Box width={labelWidth + 2}>
                    <Text color={isActive ? theme.text : theme.muted} bold={isActive}>
                      {item.label}
                    </Text>
                  </Box>
                  {item.detail && <Text color={theme.faint}>{item.detail}</Text>}
                  {item.badge && (
                    <Text color={theme.success}>
                      {"  "}
                      {item.badge}
                    </Text>
                  )}
                </Box>
              );
            })}
            {below > 0 && <Text color={theme.faint}>{`  ↓ ${below} more`}</Text>}
          </>
        )}
      </Box>

      <Hints
        hints={hints ?? (onDelete ? [...BASE_HINTS, { key: "Ctrl+D", action: "delete" }] : BASE_HINTS)}
      />
    </Panel>
  );
}
