export type ModelPricing = {
  inputUsdPerMillionTokens: number
  outputUsdPerMillionTokens: number
}

export type SupportedProvider = "anthropic" | "google" | "openai" | "openai-compatible"

type SupportedChatModeDefinition = {
  id: string
  provider: SupportedProvider
  pricing: ModelPricing
  contextWindow: number
}

export const SUPPORTED_CHAT_MODELS = [
  {
    id: "gpt-5.5",
    provider: "openai",
    pricing: {
      inputUsdPerMillionTokens: 5,
      outputUsdPerMillionTokens: 30,
    },
    contextWindow: 256_000,
  },
  {
    id: "gpt-5.5-pro",
    provider: "openai",
    pricing: {
      inputUsdPerMillionTokens: 30,
      outputUsdPerMillionTokens: 180,
    },
    contextWindow: 256_000,
  },
  {
    id: "gpt-5.4",
    provider: "openai",
    pricing: {
      inputUsdPerMillionTokens: 2.5,
      outputUsdPerMillionTokens: 15,
    },
    contextWindow: 128_000,
  },
  {
    id: "gpt-5.4-mini",
    provider: "openai",
    pricing: {
      inputUsdPerMillionTokens: 0.75,
      outputUsdPerMillionTokens: 4.5,
    },
    contextWindow: 128_000,
  },
  {
    id: "gpt-5.3-codex",
    provider: "openai",
    pricing: {
      inputUsdPerMillionTokens: 1.75,
      outputUsdPerMillionTokens: 14,
    },
    contextWindow: 200_000,
  },
  {
    id: "claude-opus-4-8",
    provider: "anthropic",
    pricing: {
      inputUsdPerMillionTokens: 5,
      outputUsdPerMillionTokens: 25,
    },
    contextWindow: 200_000,
  },
  {
    id: "claude-sonnet-4-6",
    provider: "anthropic",
    pricing: {
      inputUsdPerMillionTokens: 3,
      outputUsdPerMillionTokens: 15,
    },
    contextWindow: 200_000,
  },
  {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    pricing: {
      inputUsdPerMillionTokens: 1,
      outputUsdPerMillionTokens: 5,
    },
    contextWindow: 200_000,
  },
  {
    id: "gemini-3.5-flash",
    provider: "google",
    pricing: {
      inputUsdPerMillionTokens: 1.5,
      outputUsdPerMillionTokens: 9,
    },
    contextWindow: 1_000_000,
  },
  {
    id: "gemini-3.1-pro",
    provider: "google",
    pricing: {
      inputUsdPerMillionTokens: 2,
      outputUsdPerMillionTokens: 12,
    },
    contextWindow: 1_000_000,
  },
  {
    id: "qwen3.7-max",
    provider: "anthropic",
    pricing: {
      inputUsdPerMillionTokens: 2.5,
      outputUsdPerMillionTokens: 7.5,
    },
    contextWindow: 128_000,
  },
  {
    id: "qwen3.7-plus",
    provider: "anthropic",
    pricing: {
      inputUsdPerMillionTokens: 0.4,
      outputUsdPerMillionTokens: 1.6,
    },
    contextWindow: 128_000,
  },
  {
    id: "deepseek-v4-flash",
    provider: "openai-compatible",
    pricing: {
      inputUsdPerMillionTokens: 0.14,
      outputUsdPerMillionTokens: 0.28,
    },
    contextWindow: 128_000,
  },
  {
    id: "kimi-k2.6",
    provider: "openai-compatible",
    pricing: {
      inputUsdPerMillionTokens: 0.95,
      outputUsdPerMillionTokens: 4,
    },
    contextWindow: 128_000,
  },
  {
    id: "minimax-m2.7",
    provider: "openai-compatible",
    pricing: {
      inputUsdPerMillionTokens: 0.3,
      outputUsdPerMillionTokens: 1.2,
    },
    contextWindow: 128_000,
  },
  {
    id: "big-pickle",
    provider: "openai-compatible",
    pricing: {
      inputUsdPerMillionTokens: 0,
      outputUsdPerMillionTokens: 0,
    },
    contextWindow: 128_000,
  },
  {
    id: "deepseek-v4-flash-free",
    provider: "openai-compatible",
    pricing: {
      inputUsdPerMillionTokens: 0,
      outputUsdPerMillionTokens: 0,
    },
    contextWindow: 128_000,
  },
] as const satisfies readonly SupportedChatModeDefinition[]

export type SupportedChatModel = (typeof SUPPORTED_CHAT_MODELS)[number]

export type SupportedChatModelId = SupportedChatModel["id"]

export function normalizeChatModelId(modelId: string) {
  return modelId.startsWith("opencode/") ? modelId.slice("opencode/".length) : modelId
}

export function findSupportedChatModel(modelId: string) {
  const normalized = normalizeChatModelId(modelId)
  return SUPPORTED_CHAT_MODELS.find((model) => model.id === normalized)
}

export const DEFAULT_CHAT_MODEL_ID: SupportedChatModelId = "deepseek-v4-flash-free"

export function getModelContextWindow(modelId: string): number {
  const model = findSupportedChatModel(modelId)
  return model?.contextWindow ?? 128_000
}
