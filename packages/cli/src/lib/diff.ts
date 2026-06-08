/**
 * Block-wise unified diff generator using Myers-style LCS.
 * Produces proper grouped hunks with context lines — no more
 * "all deletes then all inserts" flat dumps.
 */

type Edit = { type: "keep" | "del" | "ins"; line: string }

/** Compute LCS edit script via DP backtracking (O(n*m) space). */
function lcsEdits(oldLines: string[], newLines: string[]): Edit[] {
  const m = oldLines.length
  const n = newLines.length

  // For very large diffs fall back to the simple approach to avoid OOM
  if (m * n > 200_000) {
    return [
      ...oldLines.map(line => ({ type: "del" as const, line })),
      ...newLines.map(line => ({ type: "ins" as const, line })),
    ]
  }

  // Build DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i]![j] = 1 + dp[i + 1]![j + 1]!
      } else {
        dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
      }
    }
  }

  // Backtrack to produce edit list
  const edits: Edit[] = []
  let i = 0, j = 0
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      edits.push({ type: "keep", line: oldLines[i]! })
      i++; j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      edits.push({ type: "del", line: oldLines[i]! })
      i++
    } else {
      edits.push({ type: "ins", line: newLines[j]! })
      j++
    }
  }
  while (i < m) { edits.push({ type: "del", line: oldLines[i]! }); i++ }
  while (j < n) { edits.push({ type: "ins", line: newLines[j]! }); j++ }

  return edits
}

type Hunk = {
  oldStart: number  // 1-indexed
  oldCount: number
  newStart: number  // 1-indexed
  newCount: number
  lines: string[]   // prefixed with ' ', '-', '+'
}

const CONTEXT = 3   // lines of surrounding context per hunk

/**
 * Generate a standard unified diff string from old/new content.
 * Returns null if either string is empty.
 */
export function generateBlockDiff(
  path: string,
  oldStr: string,
  newStr: string,
): { diffStr: string; height: number } | null {
  if (!oldStr || !newStr) return null

  const oldLines = oldStr.split("\n")
  const newLines = newStr.split("\n")
  const edits = lcsEdits(oldLines, newLines)

  // Map edit indices → old/new line numbers
  let oldLineNo = 1
  let newLineNo = 1
  type RichEdit = Edit & { oldLine: number; newLine: number }
  const rich: RichEdit[] = edits.map(e => {
    const re: RichEdit = { ...e, oldLine: oldLineNo, newLine: newLineNo }
    if (e.type === "keep") { oldLineNo++; newLineNo++ }
    else if (e.type === "del")  { oldLineNo++ }
    else                        { newLineNo++ }
    return re
  })

  // Find changed edit indices
  const changedIdx = rich.reduce<number[]>((acc, e, i) => {
    if (e.type !== "keep") acc.push(i)
    return acc
  }, [])

  if (changedIdx.length === 0) return null  // files are identical

  // Group changed indices into contiguous hunks (with context expansion)
  const ranges: Array<{ lo: number; hi: number }> = []
  for (const idx of changedIdx) {
    const lo = Math.max(0, idx - CONTEXT)
    const hi = Math.min(rich.length - 1, idx + CONTEXT)
    if (ranges.length > 0 && lo <= ranges[ranges.length - 1]!.hi + 1) {
      ranges[ranges.length - 1]!.hi = Math.max(ranges[ranges.length - 1]!.hi, hi)
    } else {
      ranges.push({ lo, hi })
    }
  }

  // Build hunk objects
  const hunks: Hunk[] = ranges.map(({ lo, hi }) => {
    const slice = rich.slice(lo, hi + 1)
    const hunkLines: string[] = []
    let oldCount = 0, newCount = 0

    for (const e of slice) {
      if (e.type === "keep")      { hunkLines.push(` ${e.line}`); oldCount++; newCount++ }
      else if (e.type === "del")  { hunkLines.push(`-${e.line}`); oldCount++ }
      else                        { hunkLines.push(`+${e.line}`); newCount++ }
    }

    const firstKeepOrDel = slice.find(e => e.type !== "ins")
    const firstIns = slice.find(e => e.type !== "del")

    return {
      oldStart: firstKeepOrDel?.oldLine ?? rich[lo]?.oldLine ?? 1,
      oldCount,
      newStart: firstIns?.newLine ?? rich[lo]?.newLine ?? 1,
      newCount,
      lines: hunkLines,
    }
  })

  // Render unified diff
  const header = `--- a/${path}\n+++ b/${path}`
  const body = hunks
    .map(h => {
      const hdr = `@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@`
      return [hdr, ...h.lines].join("\n")
    })
    .join("\n")

  const diffStr = `${header}\n${body}`

  // Height: header (2) + hunk headers + content lines, capped at 25
  const totalLines = 2 + hunks.reduce((acc, h) => acc + 1 + h.lines.length, 0)
  const height = Math.min(totalLines, 25)

  return { diffStr, height }
}
