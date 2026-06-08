import type { InputRenderable } from "@opentui/core"
import { useCallback, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { useDialog } from "../../providers/dialog"
import { useKeyboardLayer } from "../../providers/keyboard-layer"
import { useTheme } from "../../providers/theme"
import { useToast } from "../../providers/toast"
import { useSkills } from "../../providers/skills"

type Location = "global" | "project"
type Step = "location" | "name" | "description" | "prompt"

const LOCATIONS: { id: Location; label: string; detail: string }[] = [
  { id: "global", label: "Global", detail: "~/.papercode/skills.json  —  available in every project" },
  { id: "project", label: "Project", detail: ".papercode/skills.json  —  only this directory" },
]

function LocationStep({ onSelect }: { onSelect: (l: Location) => void }) {
  const { colors } = useTheme()
  const { isTopLayer } = useKeyboardLayer()
  const [idx, setIdx] = useState(0)

  useKeyboard((key) => {
    if (!isTopLayer("dialog")) return
    if (key.name === "up") { key.preventDefault(); setIdx(i => Math.max(0, i - 1)) }
    if (key.name === "down") { key.preventDefault(); setIdx(i => Math.min(LOCATIONS.length - 1, i + 1)) }
    if (key.name === "return" || key.name === "enter") {
      key.preventDefault()
      onSelect(LOCATIONS[idx]!.id)
    }
  })

  return (
    <box flexDirection="column" gap={1}>
      <text fg={colors.dim}>Where should this skill be saved?</text>
      <box flexDirection="column" gap={0} marginTop={1}>
        {LOCATIONS.map((loc, i) => {
          const selected = i === idx
          return (
            <box
              key={loc.id}
              flexDirection="row"
              gap={2}
              paddingX={1}
              backgroundColor={selected ? colors.selection : undefined}
              onMouseMove={() => setIdx(i)}
              onMouseDown={() => onSelect(loc.id)}
            >
              <text fg={selected ? colors.selectionForeground : colors.foreground}>
                {selected ? "▶ " : "  "}{loc.label}
              </text>
              <text fg={selected ? colors.selectionForeground : colors.dim}>{loc.detail}</text>
            </box>
          )
        })}
      </box>
      <text fg={colors.secondaryForeground} marginTop={1}>↑↓ move  ↵ select</text>
    </box>
  )
}

function InputStep({
  label,
  placeholder,
  hint,
  onConfirm,
  onBack,
}: {
  label: string
  placeholder: string
  hint?: string
  onConfirm: (value: string) => void
  onBack: () => void
}) {
  const { colors } = useTheme()
  const { isTopLayer } = useKeyboardLayer()
  const inputRef = useRef<InputRenderable>(null)
  const toast = useToast()

  useKeyboard((key) => {
    if (!isTopLayer("dialog")) return
    if (key.name === "return" || key.name === "enter") {
      const val = inputRef.current?.value?.trim() ?? ""
      if (!val) { toast.show({ variant: "error", message: `${label} cannot be empty` }); return }
      onConfirm(val)
    } else if (key.name === "escape") {
      onBack()
    }
  })

  return (
    <box flexDirection="column" gap={1} width="100%">
      <text fg={colors.dim}>{label}</text>
      {hint && <text fg={colors.secondaryForeground}>{hint}</text>}
      <input ref={inputRef} placeholder={placeholder} focused />
      <text fg={colors.secondaryForeground} marginTop={1}>↵ confirm  esc back</text>
    </box>
  )
}

export function SkillsDialogContent() {
  const dialog = useDialog()
  const toast = useToast()
  const { refreshSkills } = useSkills()

  const [step, setStep] = useState<Step>("location")
  const [location, setLocation] = useState<Location>("global")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const handleSave = useCallback(async (prompt: string) => {
    const apiUrl = process.env.API_URL ?? "http://localhost:3000"
    try {
      const res = await fetch(`${apiUrl}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: { name, description, prompt }, location, cwd: process.cwd() }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      refreshSkills()
      toast.show({ message: `Skill /${name} saved — type /${name} to use it` })
      dialog.close()
    } catch (err) {
      toast.show({ variant: "error", message: err instanceof Error ? err.message : "Failed to save skill" })
    }
  }, [name, description, location, refreshSkills, toast, dialog])

  if (step === "location") {
    return (
      <LocationStep onSelect={(l) => { setLocation(l); setStep("name") }} />
    )
  }

  if (step === "name") {
    return (
      <InputStep
        key="name"
        label="Skill name"
        placeholder="e.g. review"
        hint="Lowercase letters, numbers, hyphens only — becomes /name in the menu"
        onConfirm={(val) => {
          if (!/^[a-z0-9-]+$/.test(val)) {
            toast.show({ variant: "error", message: "Name must be lowercase letters, numbers, and hyphens only" })
            return
          }
          setName(val)
          setStep("description")
        }}
        onBack={() => setStep("location")}
      />
    )
  }

  if (step === "description") {
    return (
      <InputStep
        key="description"
        label="Short description"
        placeholder="e.g. Review code for bugs and security issues"
        onConfirm={(val) => { setDescription(val); setStep("prompt") }}
        onBack={() => setStep("name")}
      />
    )
  }

  return (
    <InputStep
      key="prompt"
      label="Prompt"
      placeholder="e.g. Please do a thorough code review..."
      hint="This is sent to the AI when you invoke the skill"
      onConfirm={handleSave}
      onBack={() => setStep("description")}
    />
  )
}
