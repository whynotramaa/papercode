import { type InputRenderable, type ScrollBoxRenderable } from "@opentui/core";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { useKeyboardLayer } from "../providers/keyboard-layer";
import { useKeyboard } from "@opentui/react";
import { useTheme } from "../providers/theme";

const MAX_VISIBLE_ITEMS = 6;

type DialogSearchListProps<T> = {
  items: T[]
  onSelect: (item: T) => void
  onHighlight: (item: T) => void
  filterFn: (item: T, query: string) => boolean
  renderItem: (item: T, isSelected: boolean) => ReactNode
  getKey: (item: T) => string
  placeholder?: string
  emptyText?: string
  onDeleteItem?: (item: T) => void
  onDeleteAll?: () => void
}

export function DialogSearchList<T>({ items, onSelect, onHighlight, filterFn, renderItem, getKey, placeholder = "Search", emptyText = "No results found", onDeleteItem, onDeleteAll }: DialogSearchListProps<T>) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef<InputRenderable>(null);
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const { isTopLayer } = useKeyboardLayer()
  const { colors } = useTheme()

  const handleContentChange = useCallback(() => {
    const text = inputRef.current?.value ?? ""
    setSearchValue(text)
    setSelectedIndex(0)

    const scrollbox = scrollRef.current
    if (scrollbox) {
      scrollbox.scrollTo(0)
    }
  }, [])

  const filtered = searchValue ? items.filter(item => filterFn(item, searchValue)) : items
  const visibleHeight = filtered.length > MAX_VISIBLE_ITEMS ? MAX_VISIBLE_ITEMS : filtered.length;

  useKeyboard((key) => {
    if (!isTopLayer("dialog")) return;

    if (key.name === "d" && key.option) {
      key.preventDefault()
      onDeleteAll?.()
      return
    }

    if (key.name === "d" && !key.ctrl && !key.meta && !key.shift && !key.option) {
      if (searchValue === "") {
        key.preventDefault()
        const item = filtered[selectedIndex]
        if (item) onDeleteItem?.(item)
        return
      }
    }

    if (key.name === "return" || key.name === "enter") {
      const item = filtered[selectedIndex]
      if (item) {
        onSelect(item)
      }
    } else if (key.name === "up") {
      setSelectedIndex((i) => {
        const newIndex = Math.max(0, i - 1)
        const sb = scrollRef.current
        if (sb && newIndex < sb.scrollTop) {
          sb.scrollTo(newIndex)
        }
        const item = filtered[newIndex]
        if (item && onHighlight) onHighlight(item)
        return newIndex
      })
    } else if (key.name === "down") {
      setSelectedIndex((i) => {
        const newIndex = Math.min(filtered.length - 1, i + 1)
        const sb = scrollRef.current

        if (sb) {
          const viewportHeight = sb.viewport.height
          const visibleEnd = sb.scrollTop + viewportHeight - 1
          if (newIndex > visibleEnd) {
            sb.scrollTo(newIndex - viewportHeight + 1)
          }
        }
        const item = filtered[newIndex]
        if (item && onHighlight) onHighlight(item)
        return newIndex
      })
    }
  })

  return (
    <box flexDirection="column" gap={1}>
      <input ref={inputRef} placeholder={placeholder} focused onContentChange={handleContentChange} />
      {filtered.length === 0 ? (
        <text fg={colors.dim}>
          {emptyText}
        </text>
      ) : (
        <scrollbox ref={scrollRef} height={visibleHeight}>
          {filtered.map((item, index) => {
            const isSelected = index === selectedIndex
            return (
              <box
                key={getKey(item)}
                flexDirection="row"
                height={1}
                overflow="hidden"
                backgroundColor={isSelected ? colors.selection : undefined}
                onMouseMove={() =>
                {
                  setSelectedIndex(index)
                  if (onHighlight) onHighlight(item)
                }} onMouseDown={() => onSelect(item)}>

                {renderItem(item, isSelected)}

              </box>
            )
          })}
        </scrollbox>
      )}
    </box>
  )
}
