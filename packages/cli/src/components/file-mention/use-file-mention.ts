import type { ScrollBoxRenderable } from "@opentui/core";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { useCallback, useMemo, useRef, useState, type RefObject } from "react";
import { useKeyboard } from "@opentui/react";
import { useKeyboardLayer } from "../../providers/keyboard-layer";

export type FileEntry = {
  name: string
  isDir: boolean
  fullPath: string   // relative to cwd for insertion
}

function listEntries(cwd: string, query: string): FileEntry[] {
  try {
    // Determine dir to list and the name prefix to filter by
    const slashIdx = query.lastIndexOf("/")
    const dirPart  = slashIdx >= 0 ? query.slice(0, slashIdx + 1) : ""
    const namePart = slashIdx >= 0 ? query.slice(slashIdx + 1)    : query

    const absDir = resolve(cwd, dirPart || ".")
    const entries = readdirSync(absDir)

    return entries
      .filter(name => {
        if (name.startsWith(".")) return false          // hide dotfiles
        return name.toLowerCase().startsWith(namePart.toLowerCase())
      })
      .slice(0, 50)
      .map(name => {
        const abs = join(absDir, name)
        let isDir = false
        try { isDir = statSync(abs).isDirectory() } catch { /* skip */ }
        return { name, isDir, fullPath: dirPart + name }
      })
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1   // dirs first
        return a.name.localeCompare(b.name)
      })
  } catch {
    return []
  }
}

export type UseFileMentionReturn = {
  showFileMention: boolean
  fileMentionQuery: string
  selectedIndex: number
  scrollRef: RefObject<ScrollBoxRenderable | null>
  entries: FileEntry[]
  handleContentChange: (text: string) => void
  resolveEntry: (index: number) => string | null  // returns text to insert, or null
  setSelectedIndex: (index: number) => void
}

export function useFileMention(cwd: string): UseFileMentionReturn {
  const [textValue, setTextValue]         = useState("")
  const [showFileMention, setShow]        = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const scrollRef = useRef<ScrollBoxRenderable>(null)
  const { push, pop, isTopLayer } = useKeyboardLayer()

  const close = useCallback(() => {
    setShow(false)
    pop("file-mention")
  }, [pop])

  // extract @query from end of text
  const atMatch = useMemo(() => textValue.match(/@([^\s@]*)$/), [textValue])
  const fileMentionQuery = atMatch ? atMatch[1]! : ""

  const entries = useMemo(
    () => (showFileMention ? listEntries(cwd, fileMentionQuery) : []),
    [showFileMention, fileMentionQuery, cwd]
  )

  const handleContentChange = useCallback((text: string) => {
    setTextValue(text)
    setSelectedIndex(0)
    scrollRef.current?.scrollTo(0)

    const match = text.match(/@([^\s@]*)$/)
    if (match) {
      setShow(true)
      push("file-mention", () => { close(); return true })
    } else {
      if (showFileMention) close()
    }
  }, [showFileMention, close, push])

  // Returns the full new text after substituting @query with the chosen entry
  const resolveEntry = useCallback((index: number): string | null => {
    const entry = entries[index]
    if (!entry) return null

    if (entry.isDir) {
      // don't close — update query to drill into dir
      setTextValue(prev => prev.replace(/@([^\s@]*)$/, `@${entry.fullPath}/`))
      setSelectedIndex(0)
      return null  // signal: update text but keep picker open
    }

    close()
    return entry.fullPath
  }, [entries, close])

  useKeyboard(key => {
    if (!showFileMention || !isTopLayer("file-mention")) return

    if (key.name === "Escape") {
      key.preventDefault()
      close()
    } else if (key.name === "up") {
      key.preventDefault()
      setSelectedIndex(i => {
        const next = Math.max(i - 1, 0)
        const sb = scrollRef.current
        if (sb && next < sb.scrollTop) sb.scrollTo(next)
        return next
      })
    } else if (key.name === "down") {
      key.preventDefault()
      setSelectedIndex(i => {
        const next = Math.min(i + 1, entries.length - 1)
        const sb = scrollRef.current
        if (sb) {
          const visibleEnd = sb.scrollTop + sb.viewport.height - 1
          if (next > visibleEnd) sb.scrollTo(next - sb.viewport.height + 1)
        }
        return next
      })
    }
  })

  return {
    showFileMention,
    fileMentionQuery,
    selectedIndex,
    scrollRef,
    entries,
    handleContentChange,
    resolveEntry,
    setSelectedIndex,
  }
}
