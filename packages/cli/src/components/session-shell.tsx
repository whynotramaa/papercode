import type { ReactNode } from "react";
import { InputBar } from "./input-bar";
import { TextAttributes } from "@opentui/core";
import { LoadingBar } from "./loading-bar";

type Props = {
  children?: ReactNode;
  onSubmit?: (text: string) => void;
  inputDisabled?: boolean;
  loading?: boolean;
}

export function SessionShell({ children, onSubmit, inputDisabled = false, loading = false }: Props) {
  return (
    <box flexDirection="column" flexGrow={1} width="100%" height="100%" paddingX={4} paddingTop={2} paddingBottom={1} gap={1}>

      <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="bottom">
        <box flexDirection="column" gap={2} width="100%">
          {children}
        </box>
      </scrollbox>

      <box flexShrink={0} width="100%">
        <InputBar onSubmit={onSubmit} disabled={inputDisabled} />
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
