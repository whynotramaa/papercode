import type { Command } from "./types";

export const COMMANDS: Command[] = [
  {
    name: "new",
    description: "Start a new conversation",
    value: "/new",
  },
  {
    name: "agents",
    description: "Browse and switch AI agents",
    value: "/agents",
  },
  {
    name: "sessions",
    description: "View and restore past sessions",
    value: "/sessions",
  },
  {
    name: "models",
    description: "Switch the active model",
    value: "/models",
  },
  {
    name: "login",
    description: "Sign in to your account",
    value: "/login",
  },
  {
    name: "logout",
    description: "Sign out of your account",
    value: "/logout",
  },
  {
    name: "theme",
    description: "Change the UI theme",
    value: "/theme",
  },
  {
    name: "keybindings",
    description: "View and edit keyboard shortcuts",
    value: "/keybindings",
  },
  {
    name: "help",
    description: "Show available commands and usage",
    value: "/help",
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
