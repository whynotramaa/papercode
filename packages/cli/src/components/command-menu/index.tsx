import { type ScrollBoxRenderable } from "@opentui/core";
import type { RefObject } from "react";
import type { Command } from "./types";
import { getFilteredCommands } from "./filter-command";
import { useTheme } from "../../providers/theme";

const MAX_VISIBLE_ITEMS = 8;

type CommandMenuProps = {
  query: string;
  selectedIndex: number;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
  onSelect: (index: number) => void;
  onExecute: (index: number) => void;
  skillCommands?: Command[];
}

export function CommandMenu({ query, selectedIndex, scrollRef, onSelect, onExecute, skillCommands = [] }: CommandMenuProps) {
  const {colors} = useTheme()
  const filtered = getFilteredCommands(query, skillCommands)
  const visibleHeight = Math.min(filtered.length, MAX_VISIBLE_ITEMS)
  const colWidth = filtered.length > 0
    ? Math.max(...filtered.map(cmd => cmd.name.length + (cmd.isSkill ? 2 : 0))) + 4
    : 12

  if (filtered.length === 0) {
    return (
      <box paddingX={1}>
        <text fg={colors.dim}>No commands found</text>
      </box>
    )
  }

  return (
    <scrollbox
      ref={scrollRef}
      height={visibleHeight}
      scrollbarOptions={{
        showArrows: false,
        trackOptions: { width: 1 },
      }}
    >
      {filtered.map((cmd, i) => {
        const isSelected = i === selectedIndex;
        const nameColor = isSelected ? colors.selectionForeground : (cmd.isSkill ? colors.primary : colors.foreground)
        const descColor = isSelected ? colors.selectionForeground : colors.dim
        return (
          <box
            key={cmd.value}
            flexDirection="row"
            paddingX={1}
            overflow="hidden"
            backgroundColor={isSelected ? colors.selection : undefined}
            onMouseMove={() => onSelect(i)}
            onMouseDown={() => onExecute(i)}
          >
            <box width={colWidth} flexShrink={0}>
              <text selectable={false} fg={nameColor}>
                {cmd.isSkill ? `⚡ /${cmd.name}` : `/${cmd.name}`}
              </text>
            </box>
            <box flexGrow={1} flexShrink={1} overflow="hidden">
              <text selectable={false} fg={descColor}>
                {cmd.description}
              </text>
            </box>
          </box>
        )
      })}
    </scrollbox>
  )
}
