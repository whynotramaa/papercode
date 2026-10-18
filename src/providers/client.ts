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


export function isRetryable(err: unknown): boolean {
  if (isAbort(err)) return false;
  if (err instanceof OpenAI.APIConnectionError) return true;
  if (err instanceof OpenAI.APIError) {
    const status = err.status ?? 0;
    return status === 408 || status === 409 || status === 429 || status >= 500;
  }
  return false;
}

export function retryDelay(err: unknown, attempt: number): number {
  const header = err instanceof OpenAI.APIError ? err.headers?.get?.("retry-after") : null;
  const seconds = header ? Number.parseFloat(header) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60_000);
  return Math.min(1000 * 2 ** attempt, 30_000) + Math.floor(Math.random() * 250);
}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });
}

const OVERFLOW = /context.length|context.window|maximum context|too many tokens|prompt is too long|input is too long|exceeds? the (?:context|maximum)|reduce the length|token limit/i;

export function isContextOverflow(err: unknown): boolean {
  if (!(err instanceof OpenAI.APIError)) return false;
  if (err.status !== 400 && err.status !== 413 && err.status !== 422) return false;
  return OVERFLOW.test(`${err.message} ${JSON.stringify(err.error ?? "")}`);
}
