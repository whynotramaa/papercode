import { useLocation, useNavigate } from "react-router";
import { useTheme } from "../providers/theme";
import { useEffect, useRef } from "react";
import { ErrorMessage } from "../components/message/error-message";
import { SessionShell } from "../components/session-shell";
import { UserMessage } from "../components/message/user-message";
import { BotMessage } from "../components/message/bot-message";
import { z } from "zod";
import { useToast } from "../providers/toast";
import { useMemo } from "hono/jsx";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";
import { useModel } from "../providers/model";
import type { AppMode } from "../providers/mode";

const newSessionStateSchema = z.object({
  message: z.string(),
  mode: z.enum(["BUILD", "PLAN"]).default("BUILD"),
})

export function NewSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast()
  const { selectedModel } = useModel()
 const { colors } = useTheme()
  const hasStartedRef = useRef(false);

  const state = useMemo(() => {
    const parsed = newSessionStateSchema.safeParse(location.state)
    return parsed.success ? parsed.data : null
  }, [location.state])

  useEffect(() => {
    if (!state) {
      navigate("/", { replace: true })
    }
  }, [state, navigate])


  // create session on mount
  useEffect(() => {
    if(!state || hasStartedRef.current) return
    hasStartedRef.current = true

    let ignore = false
    const createSession = async () => {
      try {
        const res = await apiClient.sessions.$post({
          json: {
            title: state.message.slice(0, 100),
            cwd: process.cwd(),
            initialMessage: {
              role: "USER",
              content: state.message,
              mode: state.mode satisfies AppMode,
              model: selectedModel
            }
          }
        })
        if(ignore) return
        if (!res.ok) {
          throw new Error(await getErrorMessage(res))
        }

        const session = await res.json()
        navigate(`/sessions/${session.id}`, { replace: true, state:{session}})

      } catch (error) {
        if (ignore) return
        toast.show({
          variant: "error",
          message: error instanceof Error ? error.message : "Failed to create session",
        })
        navigate("/", { replace: true })
      }
    }

    createSession()

    return () => {
      ignore = true
    }

  }, [state, navigate, toast, selectedModel])

  if (!state) {
    return null
  }

  return (
    <SessionShell onSubmit={()=>{}} inputDisabled loading >
      <UserMessage message={state.message} />
    </SessionShell>
      )

}
