import { findSupportedChatModel, type SupportedChatModel, type SupportedChatModelId, type SupportedProvider } from "@papercode/shared";
import type { LanguageModel } from "ai";

type DeepseekModelId = Extract<SupportedChatModel, { provider: "deepseek" }>["id"]
type GoogleModelId = Extract<SupportedChatModel, { provider: "google" }>["id"]


export type ResolvedModel = {
  model: LanguageModel;
  provider: SupportedProvider
  modelId: SupportedChatModelId
}

function assertUnsupportedProvider(provider: never): never {
  throw new Error(`Unsupported provider: ${provider}`);
}


function resolveDeepseekModel(modelId: DeepseekModelId): ResolvedModel {
  return {
    model: "deepseek/deepseek-v4-flash",
    provider: "anthropic",
    modelId,
  };
}

function resolveOpenAIModel(modelId: DeepseekModelId): ResolvedModel {
  return {
    model: "openai/gpt-4o-mini",
    provider: "openai",
    modelId,
  };
}

function resolveSupportedChatModel(model: SupportedChatModel): ResolvedModel {
  const provider = model.provider

  switch (provider) {
    case "anthropic":
      return resolveDeepseekModel(model.id as DeepseekModelId);
    case "openai":
      return resolveOpenAIModel(model.id as DeepseekModelId);
    default:
      return assertUnsupportedProvider(provider);
  }
}

export function isSupportedChatModel(model: string): model is SupportedChatModelId {
  return findSupportedChatModel(model) != null
}

export function resolveChatModel(modelId: string): ResolvedModel {
  const model = findSupportedChatModel(modelId)
  if (model == null) throw new Error(`Unsupported model: ${modelId}`)
  return resolveSupportedChatModel(model)
}

