import { useParams } from "react-router";
import { useTheme } from "../providers/theme";
import { SessionShell } from "../components/session-shell";
import type { InferResponseType } from "hono";
import { apiClient } from "../lib/api-client";
import { z } from "zod";
import { UserMessage } from "../components/message/user-message";
import { ErrorMessage } from "../components/message/error-message";
import { BotMessage } from "../components/message/bot-message";
import { ThinkingBlock } from "../components/message/thinking-block";
import { useToast } from "../providers/toast";
import { useNavigate } from "react-router";
import { useLocation } from "react-router";
import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import { getErrorMessage } from "../lib/http-errors";
import { EmptyBorder } from "../components/border";
import { chatStreamEventSchema } from "@papercode/shared";
import { useModel } from "../providers/model";
import { useAuth } from "../providers/auth";
import { findSupportedChatModel } from "@papercode/shared";
import { LoadingBar } from "../components/loading-bar";
import { CompactionBar } from "../components/compaction-bar";
import { CompactionSummary } from "../components/message/compaction-summary";
import { useKeyboard } from "@opentui/react";
import { useKeyboardLayer } from "../providers/keyboard-layer";
import type { ToolCallState } from "../components/message/tool-call-block";
import { type AppMode, ModeContext } from "../providers/mode";
import { setCompactHandler } from "../lib/compact-command";

type SessionData = InferResponseType<(typeof apiClient.sessions)[":id"]["$get"], 200>

const sessionLocationSchema = z.object({
  session: z.custom<SessionData>((val) => val != null && typeof val === "object" && "id" in val)
})

function ExchangeDivider() {
  const { colors } = useTheme()
  return (
    <box
      width="100%"
      border={["top"]}
      borderColor={colors.dimSeperator}
      customBorderChars={{
        ...EmptyBorder,
        horizontal: "─",
        topLeft: "─",
        topRight: "─",
      }}
    />
  )
}

function ChatMessage({ msg }: { msg: SessionData["messages"][number] }) {
  if (msg.role === "USER") {
    return <UserMessage message={msg.content} />
  }
  if (msg.role === "ERROR") {
    return <ErrorMessage message={msg.content} />
  }

  const toolCalls: ToolCallState[] | undefined = Array.isArray(msg.parts)
    ? (msg.parts as any[]).map(p => ({
        toolCallId: p.toolCallId ?? p.id ?? String(Math.random()),
        toolName: p.toolName ?? p.name ?? "unknown",
        args: p.args ?? {},
        status: p.isError ? ("error" as const) : ("done" as const),
        result: p.result,
      }))
    : undefined

  return <BotMessage content={msg.content} model={msg.model} toolCalls={toolCalls} />
}

async function* parseSSE(response: Response) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let eventType = ""
  let dataLine = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim()
      } else if (line.startsWith("data: ")) {
        dataLine = line.slice(6).trim()
      } else if (line === "" && dataLine) {
        yield { event: eventType, data: dataLine }
        eventType = ""
        dataLine = ""
      }
    }
  }
}

export function Session() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const { selectedModel } = useModel()
  const { getRequestCredentials } = useAuth()

  const prefetched = useMemo(() => {
    const parsed = sessionLocationSchema.safeParse(location.state)
    return parsed.success ? parsed.data.session : null
  }, [location.state])

  const { isTopLayer } = useKeyboardLayer()

  const [session, setSession] = useState(prefetched)
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [toolCalls, setToolCalls] = useState<Map<string, ToolCallState>>(new Map())
  const [streamingThinking, setStreamingThinking] = useState("")
  const [thinkingDone, setThinkingDone] = useState(false)
  const [thinkingElapsedS, setThinkingElapsedS] = useState(0)
  const thinkingStartRef = useRef<number | null>(null)
  const thinkingContentRef = useRef("")
  const [completedThinking, setCompletedThinking] = useState<{ content: string; elapsedS: number } | null>(null)
  const [mode, setMode] = useState<AppMode>("BUILD")
  const abortRef = useRef<AbortController | null>(null)
  const hasAutoStartedRef = useRef(false)
  const scrollRef = useRef<ScrollBoxRenderable>(null)

  const [notification, setNotification] = useState<string | null>(null)
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [escPending, setEscPending] = useState(false)
  const escTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [isCompacting, setIsCompacting] = useState(false)
  const [compactionInfo, setCompactionInfo] = useState<{ messageCount: number; reason: string } | null>(null)
  const [showCompacted, setShowCompacted] = useState(false)

  const toggleMode = useCallback(() => {
    setMode(prev => prev === "BUILD" ? "PLAN" : "BUILD")
  }, [])

  const showNotification = useCallback((msg: string, duration = 2000) => {
    if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current)
    setNotification(msg)
    notificationTimerRef.current = setTimeout(() => setNotification(null), duration)
  }, [])

  useEffect(() => {
    if (!isStreaming) {
      setEscPending(false)
      if (escTimerRef.current) clearTimeout(escTimerRef.current)
    }
  }, [isStreaming])

  // Auto-dismiss the "──── COMPACTED THE CONVERSATION ────" message after 5s
  useEffect(() => {
    if (!showCompacted) return
    const id = setTimeout(() => setShowCompacted(false), 5000)
    return () => clearTimeout(id)
  }, [showCompacted])

  useKeyboard((key) => {
    if (!isTopLayer("base")) return

    if (key.name === "escape" && isStreaming) {
      if (!escPending) {
        setEscPending(true)
        showNotification("press esc again to interrupt", 3000)
        escTimerRef.current = setTimeout(() => setEscPending(false), 3000)
      } else {
        if (escTimerRef.current) clearTimeout(escTimerRef.current)
        setEscPending(false)
        abortRef.current?.abort()
      }
      return
    }

    // Tab key toggles between BUILD and PLAN mode
    if (key.name === "tab" && !isStreaming) {
      key.preventDefault?.()
      setMode(prev => {
        const next = prev === "BUILD" ? "PLAN" : "BUILD"
        showNotification(`Switched to ${next} mode`, 1500)
        return next
      })
      return
    }

    if (key.name === "m" && key.ctrl && !isStreaming) {
      setMode(prev => {
        const next = prev === "BUILD" ? "PLAN" : "BUILD"
        showNotification(`Switched to ${next} mode`, 1500)
        return next
      })
    }
  })

  useEffect(() => {
    if (prefetched) return
    setSession(null)
    if (!id) return
    let ignore = false
    const fetchSession = async () => {
      try {
        const res = await apiClient.sessions[":id"].$get({ param: { id } })
        if (ignore) return
        if (!res.ok) throw new Error(await getErrorMessage(res))
        const resolved = await res.json()
        setSession(resolved)
      } catch (err) {
        if (ignore) return
        toast.show({
          variant: "error",
          message: err instanceof Error ? err.message : "Failed to fetch session",
        })
        navigate("/", { replace: true })
      }
    }
    fetchSession()
    return () => { ignore = true }
  }, [id, prefetched, toast, navigate])

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  // Register compact handler for /compact command
  useEffect(() => {
    if (!session) {
      setCompactHandler(null)
      return
    }

    setCompactHandler(async () => {
      showNotification("⧁ Compacting context...")
      try {
        const apiUrl = process.env.API_URL ?? "http://localhost:3000"
        const model = findSupportedChatModel(selectedModel)
        const creds = getRequestCredentials(model?.provider ?? "")
        const authHeaders: Record<string, string> = {}
        if (creds.apiKey) authHeaders["x-provider-api-key"] = creds.apiKey
        if (creds.baseUrl) authHeaders["x-provider-base-url"] = creds.baseUrl

        const res = await fetch(`${apiUrl}/chat/${session.id}/compact`, {
          method: "POST",
          headers: authHeaders,
        })

        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `HTTP ${res.status}`)
        }

        const data = await res.json() as { compacted: boolean; tokensSaved: number; messageCount: number; summaryPreview: string }

        if (data.compacted) {
          setShowCompacted(true)
          toast.show({ message: `Compacted! Saved ~${data.tokensSaved} tokens` })
        }

        // Re-fetch session to get updated messages (with compactedAt markers)
        const sessionRes = await apiClient.sessions[":id"].$get({ param: { id: session.id } })
        if (sessionRes.ok) {
          setSession(await sessionRes.json())
        }
      } catch (err) {
        toast.show({ variant: "error", message: err instanceof Error ? err.message : "Compaction failed" })
      }
    })

    return () => { setCompactHandler(null) }
  }, [session?.id, selectedModel, getRequestCredentials, toast])

  const streamResponse = async (sessionId: string, newMessage?: string) => {
    if (isStreaming) return
    const abort = new AbortController()
    abortRef.current = abort
    setIsStreaming(true)
    setStreamingText("")
    setToolCalls(new Map())
    setStreamingThinking("")
    setThinkingDone(false)
    setThinkingElapsedS(0)
    thinkingStartRef.current = null
    thinkingContentRef.current = ""

    try {
      const apiUrl = process.env.API_URL ?? "http://localhost:3000"
      let response: Response

      const model = findSupportedChatModel(selectedModel)
      const creds = getRequestCredentials(model?.provider ?? "")
      const authHeaders: Record<string, string> = {}
      if (creds.apiKey) authHeaders["x-provider-api-key"] = creds.apiKey
      if (creds.baseUrl) authHeaders["x-provider-base-url"] = creds.baseUrl

      if (newMessage != null) {
        response = await fetch(`${apiUrl}/chat/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ content: newMessage, model: selectedModel, mode, cwd: process.cwd() }),
          signal: abort.signal,
        })
      } else {
        response = await fetch(`${apiUrl}/chat/${sessionId}/resume`, {
          method: "POST",
          headers: authHeaders,
          signal: abort.signal,
        })
      }

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `HTTP ${response.status}`)
      }

      for await (const { data } of parseSSE(response)) {
        if (abort.signal.aborted) break
        let parsed
        try {
          parsed = chatStreamEventSchema.safeParse(JSON.parse(data))
        } catch {
          continue
        }
        if (!parsed.success) continue
        const event = parsed.data

        if (event.type === "reasoning-delta") {
          if (!thinkingStartRef.current) thinkingStartRef.current = Date.now()
          thinkingContentRef.current += event.text
          setStreamingThinking(thinkingContentRef.current)
        }

        if (event.type === "text-delta") {
          if (!thinkingDone && thinkingStartRef.current) {
            setThinkingElapsedS(Math.round((Date.now() - thinkingStartRef.current) / 1000))
            setThinkingDone(true)
          }
          setStreamingText(prev => prev + event.text)
        }

        if (event.type === "tool-call") {
          setToolCalls(prev => {
            const next = new Map(prev)
            next.set(event.toolCallId, {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              args: event.args as Record<string, unknown>,
              status: "running",
            })
            return next
          })
        }

        if (event.type === "tool-result") {
          setToolCalls(prev => {
            const next = new Map(prev)
            const existing = next.get(event.toolCallId)
            if (existing) {
              next.set(event.toolCallId, {
                ...existing,
                status: event.isError ? "error" : "done",
                result: event.result,
              })
            }
            return next
          })
        }

        if (event.type === "error") {
          toast.show({ variant: "error", message: event.message })
        }

        if (event.type === "done") {
          const res = await apiClient.sessions[":id"].$get({ param: { id: sessionId } })
          if (res.ok) {
            setSession(await res.json())
          }
          if (thinkingContentRef.current) {
            const elapsedS = thinkingStartRef.current
              ? Math.round((Date.now() - thinkingStartRef.current) / 1000)
              : 0
            setCompletedThinking({ content: thinkingContentRef.current, elapsedS })
          }
          setPendingUserMessage(null)
          setStreamingText("")
          setToolCalls(new Map())
          setStreamingThinking("")
          setThinkingDone(false)
          setThinkingElapsedS(0)
          thinkingStartRef.current = null
          thinkingContentRef.current = ""
        }

        if (event.type === "compaction-start") {
          setIsCompacting(true)
          setCompactionInfo({ messageCount: event.messageCount, reason: event.reason })
        }

        if (event.type === "compaction-done") {
          setIsCompacting(false)
          setCompactionInfo(null)
          setShowCompacted(true)
        }
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        toast.show({ variant: "error", message: err instanceof Error ? err.message : "Stream failed" })
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  const streamResponseRef = useRef(streamResponse)
  streamResponseRef.current = streamResponse

  useEffect(() => {
    if (!session || hasAutoStartedRef.current) return
    const lastMsg = session.messages[session.messages.length - 1]
    if (lastMsg?.role === "USER") {
      hasAutoStartedRef.current = true
      streamResponseRef.current(session.id)
    }
  }, [session?.id])

  const handleSubmit = (text: string) => {
    if (!session || isStreaming || !text.trim()) return
    setPendingUserMessage(text)
    streamResponse(session.id, text)
    scrollRef.current?.scrollTo(Number.MAX_SAFE_INTEGER)
  }

  const submitMessage = useCallback((text: string, skillMode?: "BUILD" | "PLAN") => {
    if (!session || isStreaming || !text.trim()) return
    if (skillMode) setMode(skillMode)
    setPendingUserMessage(text)
    streamResponse(session.id, text)
    scrollRef.current?.scrollTo(Number.MAX_SAFE_INTEGER)
  }, [session, isStreaming, streamResponse])

  const modeContextValue = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode])

  if (!session) {
    return (
      <ModeContext.Provider value={modeContextValue}>
        <SessionShell onSubmit={() => { }} inputDisabled loading notification={notification} onBlockedAction={() => showNotification("Can't switch in the middle of a stream")} scrollRef={scrollRef} />
      </ModeContext.Provider>
    )
  }

  const messages = session.messages

  return (
    <ModeContext.Provider value={modeContextValue}>
      <SessionShell
        onSubmit={handleSubmit}
        submitMessage={submitMessage}
        inputDisabled={isStreaming}
        notification={notification}
        onBlockedAction={() => showNotification("Can't switch in the middle of a stream")}
        scrollRef={scrollRef}
      >
        {messages.map((msg, index) => {
          const next = messages[index + 1]
          const isLast = index === messages.length - 1
          const isExchangeEnd = msg.role !== "USER" && (next?.role === "USER" || (isLast && !pendingUserMessage && !streamingText && toolCalls.size === 0))
          return (
            <box key={msg.id} flexDirection="column" gap={2}>
              <ChatMessage msg={msg} />
              {isExchangeEnd && <ExchangeDivider />}
            </box>
          )
        })}
        {pendingUserMessage && (
          <box flexDirection="column" gap={2}>
            <ExchangeDivider />
            <UserMessage message={pendingUserMessage} />
          </box>
        )}
        {isStreaming && !streamingText && toolCalls.size === 0 && !isCompacting && <LoadingBar />}
        {isCompacting && compactionInfo && (
          <CompactionBar messageCount={compactionInfo.messageCount} reason={compactionInfo.reason} />
        )}
        {showCompacted && <CompactionSummary />}
        {completedThinking && !isStreaming && (
          <ThinkingBlock
            content={completedThinking.content}
            isDone={true}
            elapsedS={completedThinking.elapsedS}
          />
        )}
        {(streamingText || toolCalls.size > 0 || streamingThinking) && (
          <BotMessage
            content={streamingText}
            model={selectedModel}
            toolCalls={[...toolCalls.values()]}
            isStreaming={isStreaming}
            thinking={streamingThinking || undefined}
            thinkingDone={thinkingDone}
            thinkingElapsedS={thinkingElapsedS}
          />
        )}
      </SessionShell>
    </ModeContext.Provider>
  )
}
