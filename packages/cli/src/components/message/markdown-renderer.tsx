import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../providers/theme";
import type { ThemeColors } from "../../theme";

type Props = {
  content: string;
  isStreaming?: boolean;
};

// ── inline segment types ───────────────────────────────────────────────────

type InlineSeg = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
};

// Unicode-aware: finds the next char that could start a markdown pattern.
const INLINE_SPECIAL = /\*\*\*|\*\*|\*|`/u;

function parseInline(raw: string): InlineSeg[] {
  const segs: InlineSeg[] = [];
  let s = raw;

  while (s.length > 0) {
    let m: RegExpMatchArray | null;

    // bold+italic ***text***
    m = s.match(/^\*\*\*([\s\S]+?)\*\*\*/u);
    if (m) { segs.push({ text: m[1]!, bold: true, italic: true }); s = s.slice(m[0].length); continue; }

    // bold **text**
    m = s.match(/^\*\*([\s\S]+?)\*\*/u);
    if (m) { segs.push({ text: m[1]!, bold: true }); s = s.slice(m[0].length); continue; }

    // italic *text*  (non-space boundary to avoid false positives on * in sentences)
    m = s.match(/^\*([^\s*][^*]*?[^\s*]|[^\s*])\*/u);
    if (m) { segs.push({ text: m[1]!, italic: true }); s = s.slice(m[0].length); continue; }

    // inline code `code`
    m = s.match(/^`([^`\n]+)`/u);
    if (m) { segs.push({ text: m[1]!, code: true }); s = s.slice(m[0].length); continue; }

    // plain text — jump to the next potential special char
    const next = s.search(INLINE_SPECIAL);

    if (next === -1) {
      // No more special chars — consume the entire remainder as plain text.
      // Pushing the whole string at once is also emoji-safe.
      segs.push({ text: s });
      s = "";
    } else if (next === 0) {
      // A special char is here but didn't match any pattern above (e.g. a lone *
      // mid-word, or !!! etc.) — treat it as a literal.
      // Use Array.from for a Unicode-safe single-codepoint advance (handles emoji).
      const cp = Array.from(s)[0]!;
      segs.push({ text: cp });
      s = s.slice(cp.length);
    } else {
      segs.push({ text: s.slice(0, next) });
      s = s.slice(next);
    }
  }

  return segs.filter(seg => seg.text.length > 0);
}

// ── block types ────────────────────────────────────────────────────────────

type Block =
  | { type: "blank" }
  | { type: "heading"; depth: number; text: string }
  | { type: "bullet"; ordered: false; text: string }
  | { type: "bullet"; ordered: true; n: number; text: string }
  | { type: "blockquote"; text: string }
  | { type: "code"; lang: string; lines: string[] }
  | { type: "text"; line: string }

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // fenced code block
    const fenceMatch = line.match(/^```(\w*)(\s.*)?$/);
    if (fenceMatch) {
      const lang = fenceMatch[1] ?? "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && lines[i] !== "```") {
        codeLines.push(lines[i]!);
        i++;
      }
      blocks.push({ type: "code", lang, lines: codeLines });
      i++;
      continue;
    }

    // headings
    const hMatch = line.match(/^(#{1,3}) (.+)/);
    if (hMatch) {
      blocks.push({ type: "heading", depth: hMatch[1]!.length, text: hMatch[2]! });
      i++;
      continue;
    }

    // unordered bullet
    const ulMatch = line.match(/^[-*] (.+)/);
    if (ulMatch) {
      blocks.push({ type: "bullet", ordered: false, text: ulMatch[1]! });
      i++;
      continue;
    }

    // ordered bullet
    const olMatch = line.match(/^(\d+)\. (.+)/);
    if (olMatch) {
      blocks.push({ type: "bullet", ordered: true, n: parseInt(olMatch[1]!, 10), text: olMatch[2]! });
      i++;
      continue;
    }

    // blockquote
    const qMatch = line.match(/^> (.+)/);
    if (qMatch) {
      blocks.push({ type: "blockquote", text: qMatch[1]! });
      i++;
      continue;
    }

    // blank
    if (!line.trim()) {
      blocks.push({ type: "blank" });
      i++;
      continue;
    }

    blocks.push({ type: "text", line });
    i++;
  }

  return blocks;
}

// ── inline renderer ────────────────────────────────────────────────────────

function InlineSegs({ segs, colors, heading }: { segs: InlineSeg[]; colors: ThemeColors; heading?: boolean }) {
  if (segs.length === 0) return <text fg={colors.foreground}>{" "}</text>;
  return (
    <>
      {segs.map((seg, j) => {
        if (seg.code) {
          return <text key={j} fg={colors.primary}>{seg.text}</text>;
        }
        if (seg.bold) {
          return (
            <text key={j} fg={heading ? colors.primary : colors.foreground} attributes={[TextAttributes.BOLD]}>
              {seg.text}
            </text>
          );
        }
        if (seg.italic) {
          return <text key={j} fg={colors.dim}>{seg.text}</text>;
        }
        return <text key={j} fg={heading ? colors.primary : colors.foreground}>{seg.text}</text>;
      })}
    </>
  );
}

// ── main component ─────────────────────────────────────────────────────────

export function MarkdownRenderer({ content, isStreaming }: Props) {
  const { colors } = useTheme();
  if (!content) return null;

  // During streaming: raw lines only — no parsing, no crashes
  if (isStreaming) {
    return (
      <box flexDirection="column" width="100%" gap={0} paddingLeft={4}>
        {content.split("\n").map((line, i) => (
          <text key={i} fg={colors.foreground}>{line || " "}</text>
        ))}
      </box>
    );
  }

  const blocks = parseBlocks(content);

  return (
    <box flexDirection="column" width="100%" gap={0} paddingLeft={4}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "blank":
            return <box key={i} height={1} />;

          case "heading": {
            const prefix = "#".repeat(block.depth) + " ";
            return (
              <box key={i} flexDirection="row" gap={0} marginTop={1}>
                <text fg={colors.primary} attributes={[TextAttributes.BOLD]}>{prefix}</text>
                <InlineSegs segs={parseInline(block.text)} colors={colors} heading />
              </box>
            );
          }

          case "bullet": {
            const marker = block.ordered ? `${block.n}. ` : "• ";
            return (
              <box key={i} flexDirection="row" gap={0}>
                <text fg={colors.primary}>{marker}</text>
                <InlineSegs segs={parseInline(block.text)} colors={colors} />
              </box>
            );
          }

          case "blockquote":
            return (
              <box key={i} flexDirection="row" gap={0}>
                <text fg={colors.dimSeperator}>{"▌ "}</text>
                <InlineSegs segs={parseInline(block.text)} colors={colors} />
              </box>
            );

          case "code": {
            return (
              <box key={i} flexDirection="column" gap={0} marginTop={1} marginBottom={1}>
                {block.lang ? (
                  <text fg={colors.dim}>{block.lang}</text>
                ) : null}
                {block.lines.map((line, j) => (
                  <text key={j} fg={colors.primary}>{"  "}{line || " "}</text>
                ))}
              </box>
            );
          }

          case "text": {
            const segs = parseInline(block.line);
            return (
              <box key={i} flexDirection="row" gap={0}>
                <InlineSegs segs={segs} colors={colors} />
              </box>
            );
          }

          default:
            return null;
        }
      })}
    </box>
  );
}
