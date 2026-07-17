import { createClient, describeError } from "./client.js";
import { upsertProvider, type Provider } from "../config/auth.js";

export type FetchModelsResult =
  | { ok: true; models: string[] }
  
  | { ok: false; reason: string };


const NON_CHAT = /(^|[-/])(embed|embedding|whisper|tts|dall-e|moderation|rerank|clip|stable-diffusion)/i;

export function isChatModel(id: string): boolean {
  return !NON_CHAT.test(id);
}


function rank(id: string): number {
  if (/gpt-5|claude-opus|claude-sonnet|o[34]-/i.test(id)) return 0;
  if (/gpt-4|claude|llama-3|deepseek|qwen/i.test(id)) return 1;
  return 2;
}

export async function fetchModels(provider: Provider): Promise<FetchModelsResult> {
  try {
    const client = createClient(provider);
    const page = await client.models.list();

    const models = page.data
      .map((m) => m.id)
      .filter(isChatModel)
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

    if (models.length === 0) {
      return { ok: false, reason: "The provider returned an empty model list." };
    }
    return { ok: true, models };
  } catch (err) {
    return { ok: false, reason: describeError(err) };
  }
}


export async function refreshModels(provider: Provider): Promise<FetchModelsResult> {
  const result = await fetchModels(provider);
  if (result.ok) {
    upsertProvider({ ...provider, models: result.models, fetchedAt: Date.now() });
  }
  return result;
}


export function addManualModel(provider: Provider, modelId: string): Provider {
  const id = modelId.trim();
  const models = provider.models.includes(id) ? provider.models : [...provider.models, id];
  const next: Provider = { ...provider, models };
  upsertProvider(next);
  return next;
}


export const PRESETS: { label: string; baseURL: string; hint: string }[] = [
  { label: "OpenAI", baseURL: "https://api.openai.com/v1", hint: "sk-..." },
  { label: "OpenRouter", baseURL: "https://openrouter.ai/api/v1", hint: "sk-or-..." },
  { label: "Groq", baseURL: "https://api.groq.com/openai/v1", hint: "gsk_..." },
  { label: "Together", baseURL: "https://api.together.xyz/v1", hint: "..." },
  { label: "DeepSeek", baseURL: "https://api.deepseek.com/v1", hint: "sk-..." },
  { label: "Ollama (local)", baseURL: "http://localhost:11434/v1", hint: "any value" },
];
