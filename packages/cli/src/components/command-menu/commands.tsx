import { ThemeDialogContent } from "../dialogs/theme-dialog";
import { ModelDialogContent } from "../dialogs/model-dialog";
import { ProviderSetupDialogContent, LogoutDialogContent } from "../dialogs/provider-setup-dialog";
import type { Command } from "./types";

export const COMMANDS: Command[] = [
  {
    name: "new",
    description: "Start a new conversation",
    value: "/new",
    action: (ctx) => {
      ctx.toast.show({message: "New conversation started"});
    },
  },
  {
    name: "agents",
    description: "Browse and switch AI agents",
    value: "/agents",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select agent mode",
        children: <text> Agent selection coming soon ... </text> ,
      })
    },
  },
  {
    name: "sessions",
    description: "View and restore past sessions",
    value: "/sessions",
    action: (ctx) => {
      ctx.toast.show({message: "Session list loaded"});
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
    name: "help",
    description: "Show available commands and usage",
    value: "/help",
    action: (ctx) => {
      ctx.toast.show({message: "Help loaded"});
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
