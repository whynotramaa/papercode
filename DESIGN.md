---
name: PaperCode
description: A terminal workspace for coding with your model.
colors:
  signal-background: "#101214"
  signal-panel: "#191d21"
  signal-border: "#343b43"
  signal-text: "#eceff2"
  signal-muted: "#a0aab5"
  signal-faint: "#808c98"
  signal-primary: "#e8d45b"
  signal-accent: "#96bed5"
  signal-success: "#a8c98a"
  signal-warning: "#e9b86c"
  signal-error: "#f08e8e"
  signal-code: "#b3d0df"
  graphite-background: "#151619"
  graphite-panel: "#1e2025"
  graphite-border: "#3d4149"
  graphite-text: "#f2efeb"
  graphite-muted: "#b1aba5"
  graphite-faint: "#938e89"
  graphite-primary: "#f3a36d"
  graphite-accent: "#9fc9e5"
  graphite-success: "#adc992"
  graphite-warning: "#e9c77b"
  graphite-error: "#ef9694"
  graphite-code: "#b6d7e9"
  midnight-background: "#0d1720"
  midnight-panel: "#15232e"
  midnight-border: "#304754"
  midnight-text: "#e3edf2"
  midnight-muted: "#9eb5c2"
  midnight-faint: "#819ba9"
  midnight-primary: "#65d9e4"
  midnight-accent: "#bfdb83"
  midnight-success: "#bfdb83"
  midnight-warning: "#e6bd7c"
  midnight-error: "#f297a2"
  midnight-code: "#a5d7e8"
  paper-background: "#f3f0e8"
  paper-panel: "#e7e2d8"
  paper-border: "#b5aea0"
  paper-text: "#252a2d"
  paper-muted: "#5f605b"
  paper-faint: "#6d6c64"
  paper-primary: "#984b2c"
  paper-accent: "#315d71"
  paper-success: "#45643c"
  paper-warning: "#805a15"
  paper-error: "#a13b3b"
  paper-code: "#315d71"
components:
  composer-build:
    textColor: "{colors.signal-text}"
  composer-plan:
    textColor: "{colors.signal-text}"
  workspace:
    backgroundColor: "{colors.signal-background}"
    textColor: "{colors.signal-text}"
---
# Design System: PaperCode

## Overview

**Creative North Star: "Signal console"**

PaperCode uses a full-screen character-cell workspace with a centered launch composer and a docked composer during conversation. Signal is the default; Graphite, Midnight and Paper retain the same layout and semantic color roles.

This system follows the implemented React/Ink interface. Terminal settings own the font and cell metrics. The redesign is code-led; there is no approved raster composition.

**Key Characteristics:**

- Character-cell spacing and single-line box borders.
- A stable header, scrollable work area and persistent keyboard/status rows.
- Semantic color, explicit labels and visible selection/caret markers.

## Colors

All color values live in the frontmatter and match [the theme definitions](src/ui/themes/themes.ts). Prefixes identify the palette; suffixes preserve the implementation's role names. Component frontmatter describes the default Signal palette; runtime components resolve the same roles from the active theme.

### Primary

Signal uses signal yellow; Graphite uses orange; Midnight uses cyan; Paper uses rust. `primary` marks the wordmark, build mode, active selection pointers and assistant labels. `accent` distinguishes plan mode, user labels and model information.

### Neutral

`background` paints the full terminal frame. `panel` also supplies `codeBg`; `border` separates regions. `text`, `muted` and `faint` establish text hierarchy. `heading` follows `text` and `quote` follows `muted` in every palette. Graphite's warm neutrals and Paper's light background are intentional palette differences.

`success` and `error` also supply `diffAdd` and `diffRemove`. Diffs retain explicit plus/minus markers. `warning` marks risky approvals and context above 80%. `code` colors code content. Links use `accent`, except Midnight links use `primary`. See [diff rendering](src/ui/components/DiffView.tsx) and [markdown rendering](src/ui/markdown.ts).

**The active palette rule.** Use theme roles for every frame, including erased line tails. [The CLI](src/cli.tsx) paints the actual background and default foreground, including Paper's light background.

## Typography

The terminal owns the font family, size, weight rendering and line height. There are no application font or pixel-size tokens. Ink requests bold for titles, mode labels, speaker labels and selected choices; muted/faint colors distinguish metadata. Thinking text can use italic. These attributes depend on terminal support.

The launch wordmark uses a five-row block alphabet with equal-width rows. Below 64 columns or 24 rows it becomes a compact text label. Opening the command or file palette hides the mark without remounting it. Sources: [Banner](src/ui/components/Banner.tsx), [brand](src/ui/brand.ts), [messages](src/ui/components/Messages.tsx).

## Layout

All measurements below use terminal columns and rows, never CSS pixels. [App](src/app.tsx) gives the frame `max(8, rows - 1)` rows to reserve the final terminal row. [Header](src/ui/components/Header.tsx) occupies three rows with two columns of horizontal padding. The main pane also has two columns of horizontal padding. The bottom has one status row. Contextual keyboard hints stay beside the active control, fit complete hints on one row, and prioritize Enter and Escape.

The context rail appears only when enabled and the terminal is at least 110 columns wide and 26 rows tall. It occupies 29 columns and has two columns of horizontal padding. Ctrl+B toggles it. Below 34 rows it hides its Workspace group and reduces the changed-file list. At smaller sizes, the bottom status row retains mode, model and context usage. Its additional provider, cost and thinking details depend on width.

The launch composer is horizontally centered and capped at 88 columns, with width `max(20, min(88, paneWidth - 4))`. The launch stack is vertically centered. After a conversation starts, the transcript fills the remaining height and the composer docks below it at the available pane width. Configuration views cap their content width at 80 columns. Picker pointers, labels, details and badges have separate column budgets based on the actual panel width. Preserve these constraints when adding views.

The editor shows up to four wrapped draft lines, or two below 22 rows, and keeps the caret's line visible. Its suggestion list shows between two and six rows according to available height. Standalone selectors show between three and seven items, with a scrolling selection window. Sources: [Editor](src/ui/components/Editor.tsx), [Select](src/ui/components/Select.tsx), [viewport helpers](src/ui/useViewport.ts).

## Elevation & Depth

The interface is flat. Single-line character borders, indentation and semantic color separate regions. There are no shadows or layered browser overlays. The alternate screen buffer belongs to the interactive CLI and restores the original terminal buffer on exit. See [CLI lifecycle](src/cli.tsx).

## Shapes

Use square, single-line terminal box borders. The header uses only a bottom divider; the context rail and user messages use left dividers. The composer has a complete border with a mode-colored top edge. There are no radius tokens. Shared panels use two columns of horizontal padding and one row of vertical padding. Sources: [Panel](src/ui/components/Panel.tsx), [Header](src/ui/components/Header.tsx), [ContextPanel](src/ui/components/ContextPanel.tsx), [Editor](src/ui/components/Editor.tsx).

## Components

The sidecar contains schematic HTML previews of terminal components for the design panel. These previews are documentation, not a second runtime or a browser redesign.

- The composer labels BUILD, PLAN or QUEUE A MESSAGE. Build uses `primary`; plan uses `accent`. An inverse cell marks the caret. Enter sends or queues, Tab changes mode or accepts a suggestion, and Ctrl+J inserts a newline. Terminal support can also enable modified Enter. See [Editor](src/ui/components/Editor.tsx).
- Selectors provide typed search, arrow navigation, Enter selection and Escape cancellation. The active choice combines a pointer, bold text and `primary`. A count and overflow indicators explain the bounded list. Theme selection has no decorative animation. See [Select](src/ui/components/Select.tsx).
- The context rail shows actual session, token usage, model, workspace and successful file changes. Its meter has 22 characters. A context fraction above 80% uses `warning`. See [ContextPanel](src/ui/components/ContextPanel.tsx).
- The transcript follows new content until the user scrolls back. Page Up and Page Down move by viewport height minus two rows; Page Down returns to follow mode at the end. Scrollback has an explicit status label. These keys leave the draft intact. See [ScrollArea](src/ui/components/ScrollArea.tsx).
- Approval prompts keep the tool preview or diff and explicit permission choices. Risky tools use `warning`; Escape denies. Keep these choices keyboard accessible. See [ApprovalPrompt](src/ui/components/ApprovalPrompt.tsx).
- The opening wordmark has one finite shine per mounted opening mark, using a four-character `text` highlight over `primary`. The timer advances two columns every 45 ms and stops after passing the wordmark width. Compact mode, `PAPERCODE_REDUCED_MOTION=1`, `TERM=dumb`, or a defined `NO_COLOR` disables it. See [Banner](src/ui/components/Banner.tsx).

## Do's and Don'ts

### Do:

- Do resolve every color through the active theme.
- Do keep long paths and model IDs within their allotted columns.
- Do preserve keyboard access to editing, approvals, selectors and scrollback.
- Do derive context, changed files and connection status from application state.

### Don't:

- Don't add pixel font sizes, web font stacks or CSS breakpoints to the terminal implementation.
- Don't replace state with fabricated context or integration counts.
- Don't animate theme selection or repeat the opening shine indefinitely.
- Don't rely on color alone for selection, errors or diff meaning.
