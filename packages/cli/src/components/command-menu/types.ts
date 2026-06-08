import type { DialogContextValue } from "../../providers/dialog";
import type { ToastContextValue } from "../../providers/toast";
import type { NavigateFunction } from "react-router";

export type CommandContext = {
  exit: () => void;
  toast: ToastContextValue
  dialog: DialogContextValue
  navigate: NavigateFunction
  submitMessage?: (text: string, mode?: "BUILD" | "PLAN") => void
}

export type Command = {
  name: string;
  description: string;
  value: string;
  isSkill?: boolean;
  action?: (context: CommandContext) => void | Promise<void>;
}
