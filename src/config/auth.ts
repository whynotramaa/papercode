import { z } from "zod";
import { authPath } from "./paths.js";
import { readJson, writeJson } from "./jsonFile.js";

export const ProviderSchema = z.object({
  
  name: z.string().min(1),
  
  baseURL: z.string().url(),
  apiKey: z.string(),
  
  models: z.array(z.string()).default([]),
  fetchedAt: z.number().optional(),
});

export type Provider = z.infer<typeof ProviderSchema>;

const AuthFileSchema = z.object({
  providers: z.array(ProviderSchema).default([]),
});

export type AuthFile = z.infer<typeof AuthFileSchema>;

const EMPTY: AuthFile = { providers: [] };

export function loadAuth(): AuthFile {
  const parsed = AuthFileSchema.safeParse(readJson<unknown>(authPath(), EMPTY));
  return parsed.success ? parsed.data : EMPTY;
}


export function saveAuth(auth: AuthFile): void {
  writeJson(authPath(), auth, 0o600);
}

export function listProviders(): Provider[] {
  return loadAuth().providers;
}

export function getProvider(name: string): Provider | undefined {
  return loadAuth().providers.find((p) => p.name === name);
}


export function upsertProvider(provider: Provider): void {
  const auth = loadAuth();
  const i = auth.providers.findIndex((p) => p.name === provider.name);
  if (i === -1) auth.providers.push(provider);
  else auth.providers[i] = provider;
  saveAuth(auth);
}


export function removeProvider(name: string): boolean {
  const auth = loadAuth();
  const next = auth.providers.filter((p) => p.name !== name);
  if (next.length === auth.providers.length) return false;
  saveAuth({ providers: next });
  return true;
}


export function normalizeBaseURL(input: string): string {
  let url = input.trim().replace(/\/+$/, "");
  url = url.replace(/\/chat\/completions$/, "");
  return url;
}
