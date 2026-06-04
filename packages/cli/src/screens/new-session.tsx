import { useLocation, useNavigate } from "react-router";
import { useTheme } from "../providers/theme";
import { useEffect } from "react";
import { ErrorMessage } from "../components/message/error-message";
import { SessionShell } from "../components/session-shell";
import { UserMessage } from "../components/message/user-message";
import { BotMessage } from "../components/message/bot-message";


export function NewSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const { colors } = useTheme()

  const state = location.state as { message?: string } | null;

  useEffect(() => {
    if (!state?.message) {
      navigate("/", { replace: true })
    }
  }, [state, navigate])

  if (!state?.message) {
    return null
  }

  return (
    <SessionShell onSubmit={()=>{}} inputDisabled loading >
      <UserMessage message={state.message} />
      <BotMessage content="This is sample bot response to demonstrate the message layout" model="deepseek-v4" />
      <ErrorMessage message="This is sample error message" />
    </SessionShell>
      )

}
