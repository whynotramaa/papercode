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
import { useEffect, useMemo } from "react";
import { useState } from "react";
import { getErrorMessage } from "../lib/http-errors";
import { EmptyBorder } from "../components/border";


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

function ChatMessage(
  { msg }: {
    msg: SessionData["messages"][number]
  }
) {
  if (msg.role === "USER") {
    return <UserMessage message={msg.content} />
  }
  if (msg.role === "ERROR") {
    return <ErrorMessage message={msg.content} />
  }
  return <BotMessage content={msg.content} model={msg.model} />
}


export function Session() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()

  const prefetched = useMemo(() => {
    const parsed = sessionLocationSchema.safeParse(location.state)
    return parsed.success ? parsed.data.session : null
  }, [location.state])

  const [session, setSession] = useState(prefetched)

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
      }
      catch (err) {
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

  if (!session) {
    return <SessionShell onSubmit={() => { }} inputDisabled loading />
  }

  return (
    <SessionShell onSubmit={() => { }} inputDisabled>
      {session.messages.map((msg, index) => {
        const next = session.messages[index + 1]
        const isExchangeEnd = msg.role !== "USER" && next?.role === "USER"
        return (
          <box key={msg.id} flexDirection="column" gap={2}>
            <ChatMessage msg={msg} />
            {isExchangeEnd && <ExchangeDivider />}
          </box>
        )
      })}
    </SessionShell>
  )
}
