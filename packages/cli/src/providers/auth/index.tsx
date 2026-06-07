import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { createContext, useCallback, useContext, useState, type ReactNode } from "react"

const CONFIG_DIR = join(homedir(), ".papercode")
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json")

export type SupportedCredentialProvider = "anthropic" | "openai" | "google" | "opencode-zen" | "openai-compatible"

type OpenAICompatibleCredential = { apiKey: string; baseUrl: string }

export type Credentials = {
  anthropic?: string
  openai?: string
  google?: string
  "opencode-zen"?: string
  "openai-compatible"?: OpenAICompatibleCredential
}

const ZEN_BASE_URL = "https://opencode.ai/zen/v1"

function readCredentials(): Credentials {
  try {
    return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8")) as Credentials
  } catch {
    return {}
  }
}

function persistCredentials(creds: Credentials) {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), "utf-8")
  } catch {
    // Keep usable even if write fails
  }
}

type AuthContextValue = {
  credentials: Credentials
  isSetup: boolean
  setProviderCredentials: (provider: SupportedCredentialProvider, apiKey: string, baseUrl?: string) => void
  removeProvider: (provider: SupportedCredentialProvider) => void
  getApiKey: (provider: SupportedCredentialProvider) => string | undefined
  getBaseUrl: (provider: SupportedCredentialProvider) => string | undefined
  getRequestCredentials: (modelProvider: string) => { apiKey?: string; baseUrl?: string }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<Credentials>(readCredentials)

  const isSetup = Object.keys(credentials).length > 0

  const setProviderCredentials = useCallback(
    (provider: SupportedCredentialProvider, apiKey: string, baseUrl?: string) => {
      setCredentials((prev) => {
        const next = { ...prev }
        if (provider === "openai-compatible") {
          next["openai-compatible"] = { apiKey, baseUrl: baseUrl ?? "" }
        } else {
          next[provider] = apiKey
        }
        persistCredentials(next)
        return next
      })
    },
    []
  )

  const removeProvider = useCallback((provider: SupportedCredentialProvider) => {
    setCredentials((prev) => {
      const next = { ...prev }
      delete next[provider]
      persistCredentials(next)
      return next
    })
  }, [])

  const getApiKey = useCallback(
    (provider: SupportedCredentialProvider): string | undefined => {
      if (provider === "openai-compatible") return credentials["openai-compatible"]?.apiKey
      return credentials[provider]
    },
    [credentials]
  )

  const getBaseUrl = useCallback(
    (provider: SupportedCredentialProvider): string | undefined => {
      if (provider === "opencode-zen") return ZEN_BASE_URL
      if (provider === "openai-compatible") return credentials["openai-compatible"]?.baseUrl
      return undefined
    },
    [credentials]
  )

  // Returns the best available credentials for a given model provider.
  // Priority: opencode-zen (covers all) > provider-specific key > nothing (server env fallback).
  const getRequestCredentials = useCallback(
    (modelProvider: string): { apiKey?: string; baseUrl?: string } => {
      if (credentials["opencode-zen"]) {
        return { apiKey: credentials["opencode-zen"], baseUrl: ZEN_BASE_URL }
      }
      const provider = modelProvider as SupportedCredentialProvider
      const apiKey = getApiKey(provider)
      const baseUrl = getBaseUrl(provider)
      return { apiKey, baseUrl }
    },
    [credentials, getApiKey, getBaseUrl]
  )

  return (
    <AuthContext.Provider
      value={{ credentials, isSetup, setProviderCredentials, removeProvider, getApiKey, getBaseUrl, getRequestCredentials }}
    >
      {children}
    </AuthContext.Provider>
  )
}
