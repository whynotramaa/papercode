import { createContext, useContext } from "react"

export type AppMode = "BUILD" | "PLAN"

export type ModeContextValue = {
  mode: AppMode
  toggleMode: () => void
}

export const ModeContext = createContext<ModeContextValue | null>(null)

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext)
  if (!ctx) throw new Error("useMode must be used within ModeContext.Provider")
  return ctx
}

export function useOptionalMode(): ModeContextValue | null {
  return useContext(ModeContext)
}
