import "./env";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  findSupportedChatModel,
  type SupportedChatModel,
  type SupportedChatModelId,
  type SupportedProvider,
} from "@papercode/shared";
import type { LanguageModel } from "ai";

const ZEN_BASE_URL = "https://opencode.ai/zen/v1";
const apiKey = process.env.OPENCODE_ZEN_API_KEY ?? process.env.OPENCODE_API_KEY!;

const anthropic = createAnthropic({ baseURL: ZEN_BASE_URL, apiKey, name: "opencode-zen" });
const google = createGoogleGenerativeAI({ baseURL: ZEN_BASE_URL, apiKey, name: "opencode-zen" });
const openai = createOpenAI({ baseURL: ZEN_BASE_URL, apiKey, name: "opencode-zen" });
const openaiCompatible = createOpenAICompatible({
  baseURL: ZEN_BASE_URL,
  name: "opencode-zen",
  apiKey,
});

export type ResolvedModel = {
  model: LanguageModel;
  provider: SupportedProvider;
  modelId: SupportedChatModelId;
};

function assertUnsupportedProvider(provider: never): never {
  throw new Error(`Unsupported provider: ${provider}`);
}

export type ProviderCredentials = { apiKey?: string; baseUrl?: string }

function resolveSupportedChatModel(model: SupportedChatModel, creds?: ProviderCredentials): ResolvedModel {
  const provider = model.provider;

  if (creds?.apiKey) {
    const opts = {
      apiKey: creds.apiKey,
      ...(creds.baseUrl ? { baseURL: creds.baseUrl } : {}),
    }
    switch (provider) {
      case "anthropic":
        return { model: createAnthropic(opts)(model.id as Extract<SupportedChatModel, { provider: "anthropic" }>["id"]), provider, modelId: model.id };
      case "google":
        return { model: createGoogleGenerativeAI(opts)(model.id as Extract<SupportedChatModel, { provider: "google" }>["id"]), provider, modelId: model.id };
      case "openai":
        return { model: createOpenAI(opts).responses(model.id as Extract<SupportedChatModel, { provider: "openai" }>["id"]), provider, modelId: model.id };
      case "openai-compatible":
        return { model: createOpenAICompatible({ ...opts, name: "custom", baseURL: creds.baseUrl ?? "" }).chatModel(model.id as Extract<SupportedChatModel, { provider: "openai-compatible" }>["id"]), provider, modelId: model.id };
      default:
        return assertUnsupportedProvider(provider);
    }
  }

  // Fall back to module-level Zen instances
  switch (provider) {
    case "anthropic":
      return { model: anthropic(model.id as Extract<SupportedChatModel, { provider: "anthropic" }>["id"]), provider, modelId: model.id };
    case "google":
      return { model: google(model.id as Extract<SupportedChatModel, { provider: "google" }>["id"]), provider, modelId: model.id };
    case "openai":
      return { model: openai.responses(model.id as Extract<SupportedChatModel, { provider: "openai" }>["id"]), provider, modelId: model.id };
    case "openai-compatible":
      return { model: openaiCompatible.chatModel(model.id as Extract<SupportedChatModel, { provider: "openai-compatible" }>["id"]), provider, modelId: model.id };
    default:
      return assertUnsupportedProvider(provider);
  }
}

export function isSupportedChatModel(model: string): model is SupportedChatModelId {
  return findSupportedChatModel(model) != null;
}

export function resolveChatModel(modelId: string, creds?: ProviderCredentials): ResolvedModel {
  const model = findSupportedChatModel(modelId);
  if (model == null) throw new Error(`Unsupported model: ${modelId}`);
  return resolveSupportedChatModel(model, creds);
}
