import OpenAI from "openai";
import type { Provider } from "../config/auth.js";


export function createClient(provider: Provider): OpenAI {
  return new OpenAI({
    apiKey: provider.apiKey || "not-needed",
    baseURL: provider.baseURL,
    // The UI owns retries: a silent SDK retry looks like a hang mid-stream.
    maxRetries: 0,
  });
}


export function describeError(err: unknown): string {
  if (err instanceof OpenAI.APIError) {
    const detail =
      typeof err.error === "object" && err.error !== null && "message" in err.error
        ? String((err.error as { message: unknown }).message)
        : err.message;

    switch (err.status) {
      case 401:
        return `Authentication failed (401). The API key for this provider looks invalid — re-add it with /connect.`;
      case 403:
        return `Access denied (403). ${detail}`;
      case 404:
        return `Not found (404). The model may not exist at this provider, or the baseURL may be wrong. ${detail}`;
      case 429:
        return `Rate limited (429). ${detail}`;
      default:
        return err.status && err.status >= 500
          ? `Provider error (${err.status}). ${detail}`
          : `${err.status ?? "Request failed"}: ${detail}`;
    }
  }

  if (err instanceof OpenAI.APIConnectionError) {
    return `Could not reach the provider. Check the baseURL and your connection.`;
  }

  return err instanceof Error ? err.message : String(err);
}


export function isAbort(err: unknown): boolean {
  return (
    err instanceof OpenAI.APIUserAbortError ||
    (err instanceof Error && err.name === "AbortError")
  );
}
