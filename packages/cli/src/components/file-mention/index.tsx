import type { RefObject } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useTheme } from "../../providers/theme";
import type { FileEntry } from "./use-file-mention";

const MAX_VISIBLE = 8;

type Props = {
  query: string
  entries: FileEntry[]
  selectedIndex: number
  scrollRef: RefObject<ScrollBoxRenderable | null>
  onSelect: (index: number) => void
  onExecute: (index: number) => void
}

export function FileMention({ query: _, entries, selectedIndex, scrollRef, onSelect, onExecute }: Props) {
  const { colors } = useTheme()
  const visibleHeight = Math.min(entries.length, MAX_VISIBLE)

  if (entries.length === 0) {
    return (
      <box paddingX={2} paddingY={0}>
        <text fg={colors.dim}>no files found</text>
      </box>
    )
  }

  return (
    <scrollbox
      ref={scrollRef}
      height={visibleHeight}
      scrollbarOptions={{ showArrows: false, trackOptions: { width: 1 } }}
    >
      {entries.map((entry, i) => {
        const isSelected = i === selectedIndex
        return (
          <box
            key={entry.fullPath}
            flexDirection="row"
            paddingX={2}
            gap={1}
            overflow="hidden"
            backgroundColor={isSelected ? colors.selection : undefined}
            onMouseMove={() => onSelect(i)}
            onMouseDown={() => onExecute(i)}
          >
            <text
              selectable={false}
              fg={isSelected ? colors.selectionForeground : (entry.isDir ? colors.primary : colors.dim)}
            >
              {entry.isDir ? "⊞" : "≡"}
            </text>
            <text
              selectable={false}
              fg={isSelected ? colors.selectionForeground : colors.foreground}
            >
              {entry.name}{entry.isDir ? "/" : ""}
            </text>
          </box>
        )
      })}
    </scrollbox>
  )
}
