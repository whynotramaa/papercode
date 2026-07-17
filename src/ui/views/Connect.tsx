import React, { useState } from "react";
import { Box, Text } from "ink";
import { Select } from "../components/Select.js";
import { TextPrompt } from "../components/TextPrompt.js";
import { Spinner } from "../components/Spinner.js";
import { useTheme } from "../themes/context.js";
import { PRESETS, refreshModels } from "../../providers/models.js";
import { normalizeBaseURL, upsertProvider, getProvider, type Provider } from "../../config/auth.js";

export type ConnectResult = { provider: string; model: string };

type Step =
  | { name: "preset" }
  | { name: "label"; baseURL: string; hint: string; suggested: string }
  | { name: "baseURL"; label: string }
  | { name: "key"; label: string; baseURL: string; hint: string }
  | { name: "probing"; provider: Provider }
  | { name: "manual-model"; provider: Provider; reason: string }
  | { name: "model"; provider: Provider };


export function Connect({ onDone, onCancel }: { onDone: (result: ConnectResult) => void; onCancel: () => void }) {
  const theme = useTheme();
  const [step, setStep] = useState<Step>({ name: "preset" });

  async function probe(provider: Provider) {
    setStep({ name: "probing", provider });
    const result = await refreshModels(provider);

    if (result.ok) {
      setStep({ name: "model", provider: { ...provider, models: result.models } });
    } else {
      // No /v1/models is normal for local servers — fall back, don't fail.
      setStep({ name: "manual-model", provider, reason: result.reason });
    }
  }

  if (step.name === "preset") {
    const items = [
      ...PRESETS.map((p) => ({ value: p.label, label: p.label, detail: p.baseURL })),
      { value: "__custom__", label: "Other", detail: "Any OpenAI-compatible endpoint" },
    ];

    return (
      <Select
        title="Connect a provider"
        items={items}
        onCancel={onCancel}
        onSelect={(value) => {
          if (value === "__custom__") return setStep({ name: "baseURL", label: "" });
          const preset = PRESETS.find((p) => p.label === value)!;
          setStep({
            name: "label",
            baseURL: preset.baseURL,
            hint: preset.hint,
            suggested: preset.label.split(" ")[0]!,
          });
        }}
      />
    );
  }

  /*
   * Each prompt gets a key of its step name.
   *
   * Without it React sees <TextPrompt> in the same position across steps, keeps
   * the mounted instance, and carries its `value` state forward — so the base
   * URL you just typed reappears in the name field, and the name field's text
   * shows up masked in the API key field. A key forces a remount, which is the
   * only thing that resets the state.
   */
  if (step.name === "baseURL") {
    return (
      <TextPrompt
        key="baseURL"
        label="Base URL"
        hint="The endpoint root, e.g. https://api.example.com/v1"
        onCancel={onCancel}
        validate={(v) => {
          if (!v.trim()) return "A base URL is required.";
          try {
            new URL(normalizeBaseURL(v));
            return undefined;
          } catch {
            return "That is not a valid URL.";
          }
        }}
        onSubmit={(v) => setStep({ name: "label", baseURL: normalizeBaseURL(v), hint: "", suggested: "" })}
      />
    );
  }

  if (step.name === "label") {
    return (
      <TextPrompt
        key="label"
        label="Name this provider"
        hint="How it appears in /models and the header."
        initialValue={step.suggested}
        onCancel={onCancel}
        validate={(v) => {
          if (!v.trim()) return "A name is required.";
          if (getProvider(v.trim())) return `"${v.trim()}" already exists. Pick another name.`;
          return undefined;
        }}
        onSubmit={(v) => setStep({ name: "key", label: v.trim(), baseURL: step.baseURL, hint: step.hint })}
      />
    );
  }

  if (step.name === "key") {
    return (
      <TextPrompt
        key="key"
        label={`API key for ${step.label}`}
        hint={
          step.hint
            ? `Looks like: ${step.hint}  ·  stored in ~/.papercode/auth.json, owner-only`
            : "Stored in ~/.papercode/auth.json, owner-only. Leave blank for local servers."
        }
        mask
        onCancel={onCancel}
        onSubmit={(key) => {
          const provider: Provider = { name: step.label, baseURL: step.baseURL, apiKey: key.trim(), models: [] };
          upsertProvider(provider);
          void probe(provider);
        }}
      />
    );
  }

  if (step.name === "probing") {
    return (
      <Box marginTop={1}>
        <Spinner label={`Fetching models from ${step.provider.name}…`} />
      </Box>
    );
  }

  if (step.name === "manual-model") {
    return (
      <Box flexDirection="column">
        <Box marginTop={1}>
          <Text color={theme.warning}>Could not list models: {step.reason}</Text>
        </Box>
        <TextPrompt
          key="manual-model"
          label="Model ID"
          hint="This provider does not expose /v1/models, so name the model yourself (e.g. llama3.1:8b)."
          onCancel={onCancel}
          validate={(v) => (v.trim() ? undefined : "A model ID is required.")}
          onSubmit={(v) => {
            const model = v.trim();
            upsertProvider({ ...step.provider, models: [model] });
            onDone({ provider: step.provider.name, model });
          }}
        />
      </Box>
    );
  }

  return (
    <Select
      title={`Choose a model from ${step.provider.name}`}
      items={step.provider.models.map((m) => ({ value: m, label: m }))}
      onCancel={onCancel}
      onSelect={(model) => onDone({ provider: step.provider.name, model })}
    />
  );
}
