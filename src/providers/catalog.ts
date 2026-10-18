import path from "node:path";
import { configDir } from "../config/paths.js";
import { readJson, writeJson } from "../config/jsonFile.js";
import type { ProviderKind } from "./compat.js";
import type { Usage } from "../agent/messages.js";

export type ModelInfo = {
  context: number;
  maxOutput: number;
  reasoning: boolean;
  toolCall: boolean;
  vision: boolean;
  cost?: { input: number; output: number; cacheRead?: number; cacheWrite?: number };
};

type Catalog = { fetchedAt: number; models: Record<string, ModelInfo> };

const URL = "https://models.dev/api.json";
const MAX_AGE = 24 * 60 * 60 * 1000;
export const FALLBACK_CONTEXT = 128_000;

const PROVIDER_IDS: Partial<Record<ProviderKind, string>> = {
  openai: "openai",
  openrouter: "openrouter",
  deepseek: "deepseek",
  groq: "groq",
  together: "togetherai",
  google: "google",
  anthropic: "anthropic",
};

let memo: Catalog | undefined;

function catalogPath(): string {
  return path.join(configDir(), "models-dev.json");
}

function load(): Catalog {
  memo ??= readJson<Catalog>(catalogPath(), { fetchedAt: 0, models: {} });
  return memo;
}

type RawModel = {
  limit?: { context?: number; output?: number };
  cost?: { input?: number; output?: number; cache_read?: number; cache_write?: number };
  reasoning?: boolean;
  tool_call?: boolean;
  modalities?: { input?: string[] };
};

export async function refreshCatalog(force = false): Promise<void> {
  if (!force && Date.now() - load().fetchedAt < MAX_AGE) return;
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return;
    const raw = (await res.json()) as Record<string, { models?: Record<string, RawModel> }>;
    const models: Record<string, ModelInfo> = {};
    for (const [providerId, provider] of Object.entries(raw)) {
      for (const [modelId, m] of Object.entries(provider.models ?? {})) {
        if (!m.limit?.context) continue;
        models[`${providerId}/${modelId}`] = {
          context: m.limit.context,
          maxOutput: m.limit.output ?? 0,
          reasoning: Boolean(m.reasoning),
          toolCall: Boolean(m.tool_call),
          vision: Boolean(m.modalities?.input?.includes("image")),
          ...(m.cost?.input !== undefined && m.cost.output !== undefined
            ? {
                cost: {
                  input: m.cost.input,
                  output: m.cost.output,
                  cacheRead: m.cost.cache_read,
                  cacheWrite: m.cost.cache_write,
                },
              }
            : {}),
        };
      }
    }
    memo = { fetchedAt: Date.now(), models };
    writeJson(catalogPath(), memo);
  } catch {}
}

export function modelInfo(kind: ProviderKind, model: string): ModelInfo | undefined {
  const { models } = load();
  const providerId = PROVIDER_IDS[kind];
  if (providerId && models[`${providerId}/${model}`]) return models[`${providerId}/${model}`];
  const bare = model.split("/").pop()!.toLowerCase();
  for (const [key, info] of Object.entries(models)) {
    if (key.toLowerCase().endsWith(`/${bare}`)) return info;
  }
  return undefined;
}

export function contextWindow(info: ModelInfo | undefined): number {
  return info?.context ?? FALLBACK_CONTEXT;
}

export function usageCost(info: ModelInfo | undefined, usage: Usage): number {
  const c = info?.cost;
  if (!c) return 0;
  const fresh = Math.max(0, usage.input - usage.cacheRead - usage.cacheWrite);
  return (
    (fresh * c.input +
      usage.cacheRead * (c.cacheRead ?? c.input) +
      usage.cacheWrite * (c.cacheWrite ?? c.input) +
      usage.output * c.output) /
    1_000_000
  );
}
