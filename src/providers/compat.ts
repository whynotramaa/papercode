export type ProviderKind =
  | "openai"
  | "openrouter"
  | "deepseek"
  | "groq"
  | "together"
  | "ollama"
  | "google"
  | "anthropic"
  | "generic";

export type ThinkingLevel = "off" | "low" | "medium" | "high";

export type Compat = {
  kind: ProviderKind;
  usageInStreaming: boolean;
  requiresReasoningContent: boolean;
  thinkingFormat: "openai" | "openrouter" | "none";
  cacheControl: boolean;
  cacheKey: "prompt_cache_key" | "x-session-id" | null;
};

function kindOf(baseURL: string): ProviderKind {
  const url = baseURL.toLowerCase();
  if (url.includes("api.openai.com")) return "openai";
  if (url.includes("openrouter.ai")) return "openrouter";
  if (url.includes("deepseek.com")) return "deepseek";
  if (url.includes("groq.com")) return "groq";
  if (url.includes("together.xyz")) return "together";
  if (url.includes("generativelanguage.googleapis.com")) return "google";
  if (url.includes("anthropic.com")) return "anthropic";
  if (url.includes("localhost:11434") || url.includes("127.0.0.1:11434")) return "ollama";
  return "generic";
}

export function detectCompat(baseURL: string, model: string): Compat {
  const kind = kindOf(baseURL);
  const claude = /claude|anthropic/i.test(model);
  return {
    kind,
    usageInStreaming: kind !== "ollama",
    requiresReasoningContent: kind === "deepseek" || /deepseek/i.test(model),
    thinkingFormat: kind === "openai" ? "openai" : kind === "openrouter" ? "openrouter" : "none",
    cacheControl: claude && (kind === "openrouter" || kind === "anthropic" || kind === "generic"),
    cacheKey: kind === "openai" ? "prompt_cache_key" : kind === "openrouter" ? "x-session-id" : null,
  };
}

export const GENERIC_COMPAT: Compat = detectCompat("", "");

export function thinkingParams(compat: Compat, level: ThinkingLevel | undefined): Record<string, unknown> {
  if (!level) return {};
  if (compat.thinkingFormat === "openai") return level === "off" ? {} : { reasoning_effort: level };
  if (compat.thinkingFormat === "openrouter") {
    return { reasoning: level === "off" ? { enabled: false } : { effort: level } };
  }
  return {};
}
