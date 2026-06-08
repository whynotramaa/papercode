import { useTheme } from "../../providers/theme";
import { EmptyBorder } from "../border";

export function CompactionSummary() {
  const { colors } = useTheme();

  return (
    <box width="100%" flexDirection="column" gap={0}>
      <box
        width="100%"
        border={["top"]}
        borderColor={colors.dimSeperator}
        customBorderChars={{
          ...EmptyBorder,
          horizontal: "─",
          topLeft: "─",
          topRight: "─",
        }}
      />
      <box width="100%" justifyContent="center">
        <text fg={colors.thinking} attributes={["dim"]}>──── COMPACTED THE CONVERSATION ────</text>
      </box>
    </box>
  );
}
