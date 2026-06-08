import type { InputRenderable } from "@opentui/core"
import { useCallback, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { useAuth, type SupportedCredentialProvider } from "../../providers/auth"
import { useDialog } from "../../providers/dialog"
import { useKeyboardLayer } from "../../providers/keyboard-layer"
import { useTheme } from "../../providers/theme"
import { useToast } from "../../providers/toast"
import { DialogSearchList } from "../dialog-search-list"

type ProviderOption = {
  id: SupportedCredentialProvider
  label: string
  description: string
  placeholder: string
  needsBaseUrl: boolean
  fixedBaseUrl?: string
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Claude models (Opus, Sonnet, Haiku)",
    placeholder: "sk-ant-...",
    needsBaseUrl: false,
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "GPT models",
    placeholder: "sk-...",
    needsBaseUrl: false,
  },
  {
    id: "google",
    label: "Google",
    description: "Gemini models",
    placeholder: "AIza...",
    needsBaseUrl: false,
  },
  {
    id: "opencode-zen",
    label: "OpenCode Zen",
    description: "Unified proxy — access all providers with one key",
    placeholder: "sk-...",
    needsBaseUrl: false,
    fixedBaseUrl: "https://opencode.ai/zen/v1",
  },
  {
    id: "openai-compatible",
    label: "OpenAI-Compatible",
    description: "Custom provider with OpenAI-compatible API",
    placeholder: "your-api-key",
    needsBaseUrl: true,
  },
]

function ProviderSelectStep({ onSelect }: { onSelect: (p: ProviderOption) => void }) {
  const { colors } = useTheme()
  const { credentials } = useAuth()

  return (
    <DialogSearchList
      items={PROVIDER_OPTIONS}
      onSelect={onSelect}
      onHighlight={() => {}}
      filterFn={(p, q) =>
        p.label.toLowerCase().includes(q.toLowerCase()) ||
        p.description.toLowerCase().includes(q.toLowerCase())
      }
      renderItem={(p, isSelected) => {
        const isConfigured =
          p.id === "openai-compatible"
            ? !!credentials["openai-compatible"]
            : !!credentials[p.id]
        const fg = isSelected ? colors.selectionForeground : colors.foreground
        const mutedFg = isSelected ? colors.selectionForeground : colors.dim
        return (
          <box flexDirection="row" width="100%" gap={2}>
            <text selectable={false} fg={fg}>
              {isConfigured ? " ✓ " : "   "}
              {p.label}
            </text>
            <text selectable={false} fg={mutedFg}>
              {p.description}
            </text>
          </box>
        )
      }}
      getKey={(p) => p.id}
      placeholder="Search providers..."
      emptyText="No providers found."
    />
  )
}

function ApiKeyInputStep({
  provider,
  onBack,
}: {
  provider: ProviderOption
  onBack: () => void
}) {
  const { setProviderCredentials } = useAuth()
  const dialog = useDialog()
  const { colors } = useTheme()
  const toast = useToast()
  const { isTopLayer } = useKeyboardLayer()
  const inputRef = useRef<InputRenderable>(null)
  const [phase, setPhase] = useState<"apiKey" | "baseUrl">("apiKey")
  const [savedApiKey, setSavedApiKey] = useState("")

  const needsBaseUrl = provider.needsBaseUrl && !provider.fixedBaseUrl

  const handleConfirmApiKey = useCallback(() => {
    const val = inputRef.current?.value?.trim() ?? ""
    if (!val) {
      toast.show({ variant: "error", message: "API key cannot be empty" })
      return
    }
    if (needsBaseUrl) {
      setSavedApiKey(val)
      setPhase("baseUrl")
    } else {
      setProviderCredentials(provider.id, val, provider.fixedBaseUrl)
      toast.show({ message: `${provider.label} configured — type /models to pick a model` })
      dialog.close()
    }
  }, [needsBaseUrl, provider, setProviderCredentials, toast, dialog])

  const handleConfirmBaseUrl = useCallback(() => {
    const baseUrl = inputRef.current?.value?.trim() ?? ""
    if (!baseUrl) {
      toast.show({ variant: "error", message: "Base URL cannot be empty" })
      return
    }
    setProviderCredentials(provider.id, savedApiKey, baseUrl)
    toast.show({ message: `${provider.label} configured — type /models to pick a model` })
    dialog.close()
  }, [savedApiKey, provider, setProviderCredentials, toast, dialog])

  useKeyboard((key) => {
    if (!isTopLayer("dialog")) return
    if (key.name === "return" || key.name === "enter") {
      if (phase === "apiKey") handleConfirmApiKey()
      else handleConfirmBaseUrl()
    } else if (key.name === "escape") {
      if (phase === "baseUrl") setPhase("apiKey")
      else onBack()
    }
  })

  return (
    <box flexDirection="column" gap={1} width="100%">
      <box flexDirection="row" gap={1}>
        <text fg={colors.dim}>Provider:</text>
        <text fg={colors.foreground}>{provider.label}</text>
      </box>
      {provider.fixedBaseUrl && (
        <box flexDirection="row" gap={1}>
          <text fg={colors.dim}>Base URL:</text>
          <text fg={colors.dim}>{provider.fixedBaseUrl}</text>
        </box>
      )}
      <box flexDirection="column" gap={0} marginTop={1}>
        <text fg={colors.dim}>
          {phase === "apiKey" ? "API Key" : "Base URL"}
        </text>
        {phase === "apiKey" ? (
          <input
            key="apiKey"
            ref={inputRef}
            placeholder={provider.placeholder}
            focused
          />
        ) : (
          <input
            key="baseUrl"
            ref={inputRef}
            placeholder="https://api.example.com/v1"
            focused
          />
        )}
      </box>
      <text fg={colors.secondaryForeground} marginTop={1}>
        ↵ confirm  esc back
      </text>
    </box>
  )
}

export function ProviderSetupDialogContent() {
  const [step, setStep] = useState<"select" | "configure">("select")
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption | null>(null)

  if (step === "select") {
    return (
      <ProviderSelectStep
        onSelect={(p) => {
          setSelectedProvider(p)
          setStep("configure")
        }}
      />
    )
  }

  return (
    <ApiKeyInputStep
      provider={selectedProvider!}
      onBack={() => setStep("select")}
    />
  )
}

type ConfiguredProvider = { id: SupportedCredentialProvider; label: string }

export function LogoutDialogContent() {
  const { credentials, removeProvider } = useAuth()
  const dialog = useDialog()
  const toast = useToast()
  const { colors } = useTheme()

  const configured: ConfiguredProvider[] = PROVIDER_OPTIONS.filter((p) => {
    if (p.id === "openai-compatible") return !!credentials["openai-compatible"]
    return !!credentials[p.id]
  }).map((p) => ({ id: p.id, label: p.label }))

  const handleRemove = useCallback(
    (p: ConfiguredProvider) => {
      removeProvider(p.id)
      toast.show({ message: `${p.label} removed` })
      dialog.close()
    },
    [removeProvider, toast, dialog]
  )

  if (configured.length === 0) {
    return (
      <box flexDirection="column" gap={1} paddingY={1}>
        <text fg={colors.dim}>No providers configured.</text>
        <text fg={colors.dim}>Type /login to add one.</text>
      </box>
    )
  }

  return (
    <DialogSearchList
      items={configured}
      onSelect={handleRemove}
      onHighlight={() => {}}
      filterFn={(p, q) => p.label.toLowerCase().includes(q.toLowerCase())}
      renderItem={(p, isSelected) => {
        const fg = isSelected ? colors.selectionForeground : colors.foreground
        const mutedFg = isSelected ? colors.selectionForeground : colors.dim
        return (
          <box flexDirection="row" width="100%" gap={2} paddingX={1}>
            <text selectable={false} fg={fg}>{p.label}</text>
            <text selectable={false} fg={mutedFg}>
              press ↵ to remove
            </text>
          </box>
        )
      }}
      getKey={(p) => p.id}
      placeholder="Search providers..."
      emptyText="No providers found."
    />
  )
}
