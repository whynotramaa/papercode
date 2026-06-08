
import { SUPPORTED_CHAT_MODELS, type SupportedChatModel } from "@papercode/shared"
import { useCallback } from "react"
import { useDialog } from "../../providers/dialog"
import { useModel } from "../../providers/model"
import { useTheme } from "../../providers/theme"
import { DialogSearchList } from "../dialog-search-list"

export const ModelDialogContent = () => {
  const dialog = useDialog()
  const { selectedModel, setSelectedModel } = useModel()
  const { colors } = useTheme()

  const handleSelect = useCallback(
    (model: SupportedChatModel) => {
      setSelectedModel(model.id)
      dialog.close()
    },
    [setSelectedModel, dialog]
  )

  return (
    <DialogSearchList
      items={[...SUPPORTED_CHAT_MODELS]}
      onSelect={handleSelect}
      onHighlight={() => {}}
      filterFn={(model, query) => {
        const normalizedQuery = query.toLowerCase()
        return (
          model.id.toLowerCase().includes(normalizedQuery) ||
          model.provider.toLowerCase().includes(normalizedQuery)
        )
      }}
      renderItem={(model, isSelected) => {
        const isActive = model.id === selectedModel
        const fg = isSelected ? colors.selectionForeground : colors.foreground
        const mutedFg = isSelected ? colors.selectionForeground : colors.dim
        return (
          <box flexDirection="row" width="100%" gap={1}>
            <text selectable={false} fg={fg}>
              {isActive ? " * " : "   "}
              {model.id}
            </text>
            <text selectable={false} fg={mutedFg}>
              {model.provider}
            </text>
            <text selectable={false} fg={mutedFg}>
              ${model.pricing.inputUsdPerMillionTokens}/${model.pricing.outputUsdPerMillionTokens}
            </text>
          </box>
        )
      }}
      getKey={(model) => model.id}
      placeholder="Search models..."
      emptyText="No models found."
    />
  )
}
