import { ThemeDialogContent } from "../dialogs/theme-dialog";
import { ModelDialogContent } from "../dialogs/model-dialog";
import { SessionsDialogContent } from "../dialogs/sessions-dialog";
import { ProviderSetupDialogContent, LogoutDialogContent } from "../dialogs/provider-setup-dialog";
import { SkillsDialogContent } from "../dialogs/skills-dialog";
import type { Command } from "./types";
import { useTheme } from "../../providers/theme";
import { getCompactHandler } from "../../lib/compact-command";
import { useDialog } from "../../providers/dialog";
import { useKeyboard } from "@opentui/react";
import { useKeyboardLayer } from "../../providers/keyboard-layer";

function AgentDialogContent() {
  const { colors } = useTheme()
  return <text fg={colors.foreground}> Agent selection coming soon ... </text>
}

function HelpDialogContent() {
  const { colors } = useTheme()
  const dialog = useDialog()
  const { isTopLayer } = useKeyboardLayer()

  useKeyboard((key) => {
    if (!isTopLayer("dialog")) return;
    if (key.name === "escape") {
      dialog.close()
    }
  })

  return (
    <box flexDirection="column" gap={1}>
      <text fg={colors.foreground}>
        Use Shift+Enter to insert a new line. Enter sends your message.
      </text>
      <text fg={colors.foreground}>
        Use `d` to delete the session.
      </text>
      <text fg={colors.foreground}>
        Press Tab to toggle between Build and Plan mode. Build mode has full
        read-write access (file editing, shell commands). Plan mode is read-only
        for safe exploration.
      </text>
      <text fg={colors.foreground}>
        PaperCode auto-compacts older conversation context to stay within token
        limits, preserving key decisions and tool results.
      </text>
      <text fg={colors.foreground}>
        Tools: read_file, grep, glob, list_directory, write_file, edit_file,
        and bash.
      </text>
      <box height={1} />
      <text fg={colors.dim}>https://www.github.com/whynotramaa</text>
    </box>
  )
}

export const COMMANDS: Command[] = [
  {
    name: "new",
    description: "Start a new conversation",
    value: "/new",
    action: (ctx) => {
      ctx.navigate("/");
    },
  },
  {
    name: "sessions",
    description: "View and restore past sessions",
    value: "/sessions",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Resume a session",
        children: <SessionsDialogContent />,
      });
    },
  },
  {
    name: "models",
    description: "Switch the active model",
    value: "/models",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select AI model for your task",
        children: <ModelDialogContent /> ,
      })
    },
  },
  {
    name: "login",
    description: "Configure an AI provider and API key",
    value: "/login",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Configure AI Provider",
        children: <ProviderSetupDialogContent />,
      });
    },
  },
  {
    name: "logout",
    description: "Remove a configured AI provider",
    value: "/logout",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Remove Provider",
        children: <LogoutDialogContent />,
      });
    },
  },
  {
    name: "theme",
    description: "Change the UI theme",
    value: "/theme",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select UI theme",
        children: <ThemeDialogContent />,
      })
    },
  },
  {
    name: "compact",
    description: "Manually compact conversation context",
    value: "/compact",
    action: async (ctx) => {
      const handler = getCompactHandler()
      if (handler) {
        await handler()
      } else {
        ctx.toast.show({ message: "Use /compact in an active conversation" })
      }
    },
  },
  {
    name: "skills",
    description: "Add a custom skill slash command",
    value: "/skills",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Add a skill",
        children: <SkillsDialogContent />,
      });
    },
  },
  {
    name: "help",
    description: "Show available commands and usage",
    value: "/help",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Commands",
        children: <HelpDialogContent />,
      });
    },
  },
  {
    name: "exit",
    description: "Exit the application",
    value: "/exit",
    action: (ctx) => {
      ctx.exit();
    },
  },
];
