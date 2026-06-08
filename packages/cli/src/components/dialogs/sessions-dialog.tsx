
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { useDialog } from "../../providers/dialog"
import { useTheme } from "../../providers/theme"
import { useToast } from "../../providers/toast"
import { DialogSearchList } from "../dialog-search-list"
import { apiClient } from "../../lib/api-client"
import type { InferResponseType } from "hono"

type SessionItem = InferResponseType<typeof apiClient.sessions.$get, 200>[number]

function timeAgo(date: Date | string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function SessionsDialogContent() {
  const dialog = useDialog()
  const navigate = useNavigate()
  const { colors } = useTheme()
  const toast = useToast()
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    const fetchSessions = async () => {
      try {
        const res = await apiClient.sessions.$get()
        if (!res.ok) {
          throw new Error("Failed to fetch sessions")
        }
        const data = await res.json()
        if (!ignore) {
          setSessions(data)
          setLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load sessions")
          setLoading(false)
        }
      }
    }
    fetchSessions()
    return () => { ignore = true }
  }, [])

  const handleSelect = useCallback(
    (session: SessionItem) => {
      dialog.close()
      navigate(`/sessions/${session.id}`)
    },
    [dialog, navigate]
  )

  const handleDeleteItem = useCallback(
    async (session: SessionItem) => {
      try {
        const res = await apiClient.sessions[":id"].$delete({ param: { id: session.id } })
        if (!res.ok) throw new Error("Failed to delete session")
        setSessions((prev) => prev.filter((s) => s.id !== session.id))
        toast.show({ message: "Session deleted" })
      } catch {
        toast.show({ variant: "error", message: "Failed to delete session" })
      }
    },
    [toast]
  )

  const handleDeleteAll = useCallback(
    async () => {
      try {
        const res = await apiClient.sessions.$delete()
        if (!res.ok) throw new Error("Failed to delete sessions")
        setSessions([])
        toast.show({ message: "All sessions deleted" })
      } catch {
        toast.show({ variant: "error", message: "Failed to delete sessions" })
      }
    },
    [toast]
  )

  if (loading) {
    return <text fg={colors.dim}>Loading sessions...</text>
  }

  if (error) {
    return <text fg={colors.error}>{error}</text>
  }

  if (sessions.length === 0) {
    return <text fg={colors.dim}>No past sessions found.</text>
  }

  return (
    <DialogSearchList
      items={sessions}
      onSelect={handleSelect}
      onHighlight={() => {}}
      onDeleteItem={handleDeleteItem}
      onDeleteAll={handleDeleteAll}
      filterFn={(session, query) => {
        return session.title.toLowerCase().includes(query.toLowerCase())
      }}
      renderItem={(session, isSelected) => {
        const fg = isSelected ? colors.selectionForeground : colors.foreground
        const mutedFg = isSelected ? colors.selectionForeground : colors.dim
        return (
          <box flexDirection="row" width="100%" justifyContent="space-between">
            <box flexGrow={1} flexShrink={1} overflow="hidden">
              <text selectable={false} fg={fg}>
                {session.title}
              </text>
            </box>
            <box flexShrink={0} paddingLeft={2}>
              <text selectable={false} fg={mutedFg}>
                {timeAgo(session.createdAt)}
              </text>
            </box>
          </box>
        )
      }}
      getKey={(session) => session.id}
      placeholder="Search sessions..."
      emptyText="No matching sessions."
    />
  )
}
