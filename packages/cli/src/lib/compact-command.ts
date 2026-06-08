type CompactResult = { tokensSaved: number; messageCount: number } | null
type CompactHandler = () => Promise<CompactResult>

let currentHandler: CompactHandler | null = null

export function setCompactHandler(handler: CompactHandler | null) {
  currentHandler = handler
}

export function getCompactHandler(): CompactHandler | null {
  return currentHandler
}
