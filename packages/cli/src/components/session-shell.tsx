import type { ReactNode } from "react";
import { InputBar } from "./input-bar";
import { TextAttributes } from "@opentui/core";
import { LoadingBar } from "./loading-bar";
import { useTheme } from "../providers/theme";

type Props = {
  children?: ReactNode;
  onSubmit?: (text: string) => void;
  inputDisabled?: boolean;
  loading?: boolean;
  notification?: string | null;
  onBlockedAction?: () => void;
}

export function SessionShell({ children, onSubmit, inputDisabled = false, loading = false, notification, onBlockedAction }: Props) {
  const { colors } = useTheme()

  return (
    <box flexDirection="column" flexGrow={1} width="100%" height="100%" paddingX={4} paddingTop={2} paddingBottom={1} gap={1}>

      <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="bottom">
        <box flexDirection="column" gap={2} width="100%">
          {children}
        </box>
      </scrollbox>

      {notification && (
        <box flexShrink={0} width="100%" paddingX={1}>
          <text fg={colors.thinking} attributes={TextAttributes.DIM}>{notification}</text>
        </box>
      )}

      <box flexShrink={0} width="100%">
        <InputBar onSubmit={onSubmit ?? (() => {})} disabled={inputDisabled} onBlockedAction={onBlockedAction} />
      </box>

      <box flexShrink={0} flexDirection="row" justifyContent="space-between" width="100%" height={1}>
        <box flexDirection="row" alignItems="center">
          {loading ? <LoadingBar /> : null}
        </box>
        <box flexDirection="row" gap={1}>
          <text attributes={TextAttributes.DIM}>shift↵</text>
          <text attributes={TextAttributes.DIM}>newline</text>
          <text attributes={TextAttributes.DIM}>  ·  </text>
          <text attributes={TextAttributes.DIM}>tab</text>
          <text attributes={TextAttributes.DIM}>agents</text>
        </box>
      </box>

    </box>
  )
}
