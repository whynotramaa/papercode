import { DEFAULT_CHAT_MODEL_ID, findSupportedChatModel, type SupportedChatModelId } from "@papercode/shared"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { createContext, useCallback, useContext, useState, type ReactNode } from "react"

const CONFIG_DIR = join(homedir(), ".papercode")
const MODEL_PREFERENCES_PATH = join(CONFIG_DIR, "model-preferences.json")

type ModelPreferences = {
  modelId: string
}

function getInitialModel(): SupportedChatModelId {
  try {
    const preferences = JSON.parse(readFileSync(MODEL_PREFERENCES_PATH, "utf-8")) as Partial<ModelPreferences>
    const savedModel = preferences.modelId ? findSupportedChatModel(preferences.modelId) : null
    return savedModel?.id ?? DEFAULT_CHAT_MODEL_ID
  } catch {
    return DEFAULT_CHAT_MODEL_ID
  }
}

function persistModel(model: SupportedChatModelId) {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(MODEL_PREFERENCES_PATH, JSON.stringify({ modelId: model } satisfies ModelPreferences, null, 2), "utf-8")
  } catch {
    // Keep model switching usable even if preferences cannot be written.
  }
}

type ModelContextValue = {
  selectedModel: SupportedChatModelId
  setSelectedModel: (model: SupportedChatModelId) => void
}

const ModelContext = createContext<ModelContextValue | null>(null)

export const useModel = (): ModelContextValue => {
  const context = useContext(ModelContext)
  if (context === null) {
    throw new Error("useModel must be used within a ModelProvider")
  }
  return context
}

type ModelProviderProps = {
  children: ReactNode
}

export function ModelProvider({ children }: ModelProviderProps) {
  const [selectedModel, setSelectedModelState] = useState<SupportedChatModelId>(getInitialModel)

  const setSelectedModel = useCallback((model: SupportedChatModelId) => {
    if (!findSupportedChatModel(model)) return
    setSelectedModelState(model)
    persistModel(model)
  }, [])

  return (
    <ModelContext.Provider value={{ selectedModel, setSelectedModel }}>
      {children}
    </ModelContext.Provider>
  )
}
