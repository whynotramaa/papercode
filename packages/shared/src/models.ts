export type ModelPricing = {
  inputUsdPerMillionTokens: number
  outputUsdPerMillionTokens: number
}

export type SupportedProvider = "anthropic" | "openai"

type SupportedChatModeDefinition = {
  id: string
  provider: SupportedProvider
  pricing: ModelPricing
}


export const SUPPORTED_CHAT_MODELS = [
  {
    id: "claude-sonnet-4-6",
    provider: "anthropic",
    pricing: {
      inputUsdPerMillionTokens: 3,
      outputUsdPerMillionTokens: 15,
    },
  },
  {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    pricing: {
      inputUsdPerMillionTokens: 0,
      outputUsdPerMillionTokens: 0,
    },
  },
  {
    id: "gpt-5-5",
    provider: "openai",
    pricing: {
      inputUsdPerMillionTokens: 0,
      outputUsdPerMillionTokens: 0,
    },
  },
  ] as const satisfies readonly SupportedChatModeDefinition[]


export type SupportedChatModel = (typeof SUPPORTED_CHAT_MODELS)[number]

export type SupportedChatModelId = SupportedChatModel["id"]

export function findSupportedChatModel(modelId: string) {
  return SUPPORTED_CHAT_MODELS.find((model) => model.id === modelId)
}


export const DEFAULT_CHAT_MODEL_ID: SupportedChatModelId = "claude-sonnet-4-6"


