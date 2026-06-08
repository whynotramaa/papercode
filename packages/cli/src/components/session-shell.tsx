import type { ReactNode, RefObject } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import { InputBar } from "./input-bar";

import { LoadingBar } from "./loading-bar";
import { useTheme } from "../providers/theme";

type Props = {
  children?: ReactNode;
  onSubmit?: (text: string) => void;
  inputDisabled?: boolean;
  loading?: boolean;
  notification?: string | null;
  onBlockedAction?: () => void;
  scrollRef?: RefObject<ScrollBoxRenderable | null>;
  submitMessage?: (text: string, mode?: "BUILD" | "PLAN") => void;
}

export function SessionShell({ children, onSubmit, inputDisabled = false, loading = false, notification, onBlockedAction, scrollRef, submitMessage }: Props) {
  const { colors } = useTheme()

  return (
    <box flexDirection="column" flexGrow={1} width="100%" height="100%" paddingX={4} paddingTop={2} paddingBottom={1} gap={1}>

      <scrollbox
        ref={scrollRef}
        flexGrow={1}
        width="100%"
        stickyScroll
        stickyStart="bottom"
      >
        <box flexDirection="column" gap={2} width="100%">
          {children}
        </box>
      </scrollbox>

      {notification && (
        <box flexShrink={0} width="100%" paddingX={1}>
          <text fg={colors.thinking}>{notification}</text>
        </box>
      )}

      <box flexShrink={0} width="100%">
        <InputBar onSubmit={onSubmit ?? (() => {})} disabled={inputDisabled} onBlockedAction={onBlockedAction} submitMessage={submitMessage} />
      </box>

      <box flexShrink={0} flexDirection="row" justifyContent="space-between" width="100%" height={1}>
        <box flexDirection="row" alignItems="center">
          <text fg={colors.secondaryForeground}>@whynotramaa</text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg={colors.secondaryForeground}>shift↵</text>
          <text fg={colors.secondaryForeground}>newline</text>
          <text fg={colors.secondaryForeground}>  ·  </text>
          <text fg={colors.secondaryForeground}></text>
          <text fg={colors.secondaryForeground}>mode</text>
          <text fg={colors.secondaryForeground}>  ·  </text>
          <text fg={colors.secondaryForeground}>@</text>
          <text fg={colors.secondaryForeground}>files</text>
        </box>
      </box>

    </box>
  )
}
