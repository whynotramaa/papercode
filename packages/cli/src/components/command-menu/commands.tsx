import { ThemeDialogContent } from "../dialogs/theme-dialog";
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
        children: <text> Model selection coming soon ... </text> ,
      })
    },
  },
  {
    name: "login",
    description: "Sign in to your account",
    value: "/login",
    action: (ctx) => {
      ctx.toast.show({message: "Login successful"});
    },
  },
  {
    name: "logout",
    description: "Sign out of your account",
    value: "/logout",
    action: (ctx) => {
      ctx.toast.show({message: "Logout successful"});
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
    name: "keybindings",
    description: "View and edit keyboard shortcuts",
    value: "/keybindings",
    action: (ctx) => {
      ctx.toast.show({message: "Keybindings loaded"});
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
