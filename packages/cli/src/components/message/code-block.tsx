import { useTheme } from "../../providers/theme";
import type { ThemeColors } from "../../theme";

type Props = {
  code: string;
  language: string;
  isStreaming?: boolean;
};

function getDisplayLanguage(lang: string): string {
  const map: Record<string, string> = {
    ts: "TypeScript", js: "JavaScript", py: "Python",
    rs: "Rust", go: "Go", sh: "Shell", bash: "Bash",
    sql: "SQL", json: "JSON", html: "HTML", css: "CSS",
    yaml: "YAML", md: "Markdown", diff: "Diff",
  };
  return map[lang] ?? lang;
}

function normalizeLang(lang: string): string {
  const alias: Record<string, string> = {
    ts: "typescript", js: "javascript", py: "python",
    rs: "rust", sh: "shell",
  };
  return alias[lang] ?? lang;
}

type DiffLineType = "header" | "hunk" | "added" | "removed" | "context" | "empty";

const DIFF_HEADER_RE = /^(diff --git|---|\+\+\+|new file|deleted file|index |Binary files|rename (from|to)|similarity index)/;

function classifyDiffLine(line: string): DiffLineType {
  if (line === "") return "empty";
  if (DIFF_HEADER_RE.test(line)) return "header";
  if (/^@@/.test(line)) return "hunk";
  if (line.startsWith("+")) return "added";
  if (line.startsWith("-")) return "removed";
  return "context";
}

function getDiffBg(colors: ThemeColors): { removed: string; added: string } {
  const r = parseInt(colors.background.slice(1, 3), 16);
  const g = parseInt(colors.background.slice(3, 5), 16);
  const b = parseInt(colors.background.slice(5, 7), 16);
  const isDark = (r * 299 + g * 587 + b * 114) / 1000 < 128;
  return {
    removed: isDark ? "#2d1b1b" : "#ffebe9",
    added: isDark ? "#1b2d1b" : "#dafbe1",
  };
}

function renderDiffLine(lineText: string, i: number, colors: ThemeColors) {
  const type = classifyDiffLine(lineText);
  const diffBg = getDiffBg(colors);

  if (type === "empty") {
    return <box key={i} height={1} />;
  }

  if (type === "header") {
    return (
      <box key={i} flexDirection="row" gap={0} width="100%">
        <text fg={colors.secondaryForeground}>       </text>
        <text fg={colors.primary}>{lineText}</text>
      </box>
    );
  }

  if (type === "hunk") {
    return (
      <box key={i} flexDirection="row" gap={0} width="100%">
        <text fg={colors.secondaryForeground}>       </text>
        <text fg={colors.info}>{lineText}</text>
      </box>
    );
  }

  const isRemoved = type === "removed";
  const isAdded = type === "added";

  if (type === "context") {
    return (
      <box key={i} flexDirection="row" gap={0} width="100%">
        <text fg={colors.secondaryForeground}>{String(i + 1).padStart(3, " ")}</text>
        <text fg={colors.dimSeperator}>{"\u2502"}</text>
        <text fg={colors.foreground}>{lineText}</text>
      </box>
    );
  }

  return (
    <box key={i} flexDirection="row" gap={0} width="100%" backgroundColor={isRemoved ? diffBg.removed : diffBg.added}>
      <text fg={colors.secondaryForeground}>{String(i + 1).padStart(3, " ")}</text>
      <text fg={isRemoved ? colors.error : colors.success}>{"\u2502"}</text>
      <text fg={colors.foreground}>{lineText}</text>
    </box>
  );
}

export function CodeBlock({ code, language, isStreaming }: Props) {
  const { colors } = useTheme();
  const isDiff = normalizeLang(language) === "diff";
  const lines = code.split("\n");

  return (
    <box flexDirection="column" width="100%" gap={0} backgroundColor={colors.surface}>
      <box
        width="100%"
        border={["bottom"]}
        borderColor={colors.dimSeperator}
        customBorderChars={{ horizontal: "\u2500" }}
      >
        <box paddingX={2} paddingY={0}>
          <text fg={colors.dim}>{getDisplayLanguage(language)}</text>
        </box>
      </box>

      <box flexDirection="column" gap={0} paddingX={2} paddingY={1}>
        {lines.map((line, i) =>
          isDiff ? (
            renderDiffLine(line, i, colors)
          ) : (
            <box key={i} flexDirection="row" gap={0} width="100%">
              <text fg={colors.secondaryForeground}>{String(i + 1).padStart(3, " ")}  </text>
              <text fg={colors.foreground}>{line || " "}</text>
            </box>
          ),
        )}
      </box>
    </box>
  );
}
