import { useParams } from "react-router";
import { useTheme } from "../providers/theme";
import { SessionShell } from "../components/session-shell";

export function Session() {
  const { id } = useParams()
  const { colors } = useTheme()

  return <SessionShell onSubmit={() => {}} inputDisabled loading />
}
