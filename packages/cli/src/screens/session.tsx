import { useParams } from "react-router";
import { useTheme } from "../providers/theme";
import { SessionShell } from "../components/session-shell";
import type { InferResponseType } from "hono";
import { apiClient } from "../lib/api-client";
import { z } from "zod";
import { UserMessage } from "../components/message/user-message";
import { ErrorMessage } from "../components/message/error-message";
import { BotMessage } from "../components/message/bot-message";
import { useToast } from "../providers/toast";
import { useNavigate } from "react-router";
import { useLocation } from "react-router";
import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { getErrorMessage } from "../lib/http-errors";
import { EmptyBorder } from "../components/border";
import { chatStreamEventSchema } from "@papercode/shared";
import { useModel } from "../providers/model";
import { useAuth } from "../providers/auth";
import { findSupportedChatModel } from "@papercode/shared";
import { LoadingBar } from "../components/loading-bar";
import { useKeyboard } from "@opentui/react";
import { useKeyboardLayer } from "../providers/keyboard-layer";

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
  return <BotMessage content={msg.content} model={msg.model} />
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
  const abortRef = useRef<AbortController | null>(null)
  const hasAutoStartedRef = useRef(false)

  const [notification, setNotification] = useState<string | null>(null)
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [escPending, setEscPending] = useState(false)
  const escTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showNotification = useCallback((msg: string, duration = 2000) => {
    if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current)
    setNotification(msg)
    notificationTimerRef.current = setTimeout(() => setNotification(null), duration)
  }, [])

  // Reset esc pending when streaming ends
  useEffect(() => {
    if (!isStreaming) {
      setEscPending(false)
      if (escTimerRef.current) clearTimeout(escTimerRef.current)
    }
  }, [isStreaming])

  useKeyboard((key) => {
    if (key.name !== "escape") return
    if (!isStreaming) return
    if (!isTopLayer("base")) return

    if (!escPending) {
      setEscPending(true)
      showNotification("press esc again to interrupt", 3000)
      escTimerRef.current = setTimeout(() => setEscPending(false), 3000)
    } else {
      if (escTimerRef.current) clearTimeout(escTimerRef.current)
      setEscPending(false)
      abortRef.current?.abort()
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

  // Abort stream on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const streamResponse = async (sessionId: string, newMessage?: string) => {
    if (isStreaming) return
    const abort = new AbortController()
    abortRef.current = abort
    setIsStreaming(true)
    setStreamingText("")

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
          body: JSON.stringify({ content: newMessage, model: selectedModel, mode: "BUILD" }),
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

        if (event.type === "text-delta") {
          setStreamingText(prev => prev + event.text)
        }
        if (event.type === "error") {
          toast.show({ variant: "error", message: event.message })
        }
        if (event.type === "done") {
          const res = await apiClient.sessions[":id"].$get({ param: { id: sessionId } })
          if (res.ok) {
            setSession(await res.json())
          }
          setPendingUserMessage(null)
          setStreamingText("")
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

  // Auto-resume when session loads with a pending user message
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
  }

  if (!session) {
    return <SessionShell onSubmit={() => { }} inputDisabled loading notification={notification} onBlockedAction={() => showNotification("Can't switch in the middle of a stream")} />
  }

  const messages = session.messages

  return (
    <SessionShell
      onSubmit={handleSubmit}
      inputDisabled={isStreaming}
      notification={notification}
      onBlockedAction={() => showNotification("Can't switch in the middle of a stream")}
    >
      {messages.map((msg, index) => {
        const next = messages[index + 1]
        const isLast = index === messages.length - 1
        const isExchangeEnd = msg.role !== "USER" && (next?.role === "USER" || (isLast && !pendingUserMessage && !streamingText))
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
      {isStreaming && !streamingText && <LoadingBar />}
      {streamingText && (
        <BotMessage content={streamingText} model={selectedModel} />
      )}
    </SessionShell>
  )
}
