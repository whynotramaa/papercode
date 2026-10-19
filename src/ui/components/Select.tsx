import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../themes/context.js";
import { useViewport, listCapacity, useElementWidth } from "../useViewport.js";
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
  onArrow?: (dir: -1 | 1) => void;
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
  onArrow,
  hints,
  emptyMessage = "Nothing here yet.",
}: SelectProps<T>) {
  const theme = useTheme();
  const { rows, columns } = useViewport();
  const list = useElementWidth();
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
  const capacity = Math.min(7, listCapacity(rows, 16));
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
    if (onArrow && (key.leftArrow || key.rightArrow)) return onArrow(key.leftArrow ? -1 : 1);
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
  const badgeWidth = Math.min(9, Math.max(0, ...items.map((item) => item.badge?.length ?? 0)));
  const labelWidth = Math.min(32, Math.max(4, Math.floor(((list.width || columns - 12) - (badgeWidth ? badgeWidth + 2 : 0) - 4) * 0.5)), Math.max(8, ...items.map((i) => i.label.length)));

  const counter =
    filtered.length === items.length
      ? `${filtered.length}`
      : `${filtered.length}/${items.length}`;

  return (
    <Panel title={title} corner={items.length > 0 ? counter : undefined}>
      <Box height={1} flexShrink={0}>
        <Text wrap="truncate-end" color={query ? theme.text : theme.faint}>
          <Text color={theme.primary}>{"/ "}</Text>{query || "type to search"}{query && <Text color={theme.primary}>▏</Text>}
        </Text>
      </Box>

      <Box ref={list.ref} flexDirection="column" marginTop={1}>
        {items.length === 0 ? (
          <Text color={theme.faint}>{emptyMessage}</Text>
        ) : filtered.length === 0 ? (
          <Text color={theme.faint}>No matches for “{query}”.</Text>
        ) : (
          <>
            {visible.map((item, i) => {
              const real = start + i;
              const isActive = real === active;
              return (
                <Box key={real} height={1} flexShrink={0}>
                  <Box width={2} flexShrink={0}><Text color={isActive ? theme.primary : theme.faint}>{isActive ? ">" : " "}</Text></Box>
                  <Box width={labelWidth} flexShrink={0} marginRight={2}>
                    <Text color={isActive ? theme.text : theme.muted} bold={isActive} wrap="truncate-end">
                      {item.label}
                    </Text>
                  </Box>
                  <Box flexGrow={1} minWidth={0}><Text color={theme.faint} wrap="truncate-end">{item.detail ?? " "}</Text></Box>
                  {badgeWidth > 0 && (
                    <Box flexShrink={0} width={badgeWidth} marginLeft={2}><Text color={theme.success} wrap="truncate-end">{item.badge ?? " "}</Text></Box>
                  )}
                </Box>
              );
            })}
            {filtered.length > capacity && <Text color={theme.faint}>{`${start + 1}-${start + visible.length} of ${filtered.length} · ${filtered.length - visible.length} more`}</Text>}
          </>
        )}
      </Box>

      <Hints
        hints={hints ?? (onDelete ? [...BASE_HINTS, { key: "Ctrl+D", action: "delete" }] : BASE_HINTS)}
      />
    </Panel>
  );
}
