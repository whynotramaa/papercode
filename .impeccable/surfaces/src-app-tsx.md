---
version: 1
slug: "src-app-tsx"
primary_target: "src/app.tsx"
related_targets: ["src/ui/components/Editor.tsx","src/ui/themes/themes.ts"]
---

# Terminal workspace

## Scope and mode
Operate. Replace the Ink terminal interface while preserving agent, tool and session behavior. Terminal-native code-led implementation; raster comps are not the deliverable.

## Direction
Seed 651372d7. The user's explicit OpenCode-like centered composer, persistent context rail and delegated fourth theme take priority. Use a signal-console layout with square edges, calm negative space and yellow focus. Keep three additional themes as requested.

## First viewport
Full terminal height. A three-row header establishes workspace and connection. A centered two-line wordmark sits above the launch composer. The right rail shows real model, context usage, session and integration information. A single status row anchors the bottom; contextual hints sit beside their controls. At narrow sizes the rail collapses and critical status remains in the footer.

## Task and interaction
Sending a task replaces the launch illustration with a scrollable transcript and docks the composer below it. Page Up and Page Down navigate history without changing the draft. Ctrl+B toggles the context rail. Model/theme/session selectors remain compact, searchable and bounded. Preserve approvals, queueing and plan/build mode.

## Quality bar
No clipping or terminal scroll on 80x24 and 120x36. Input has a visible caret, supports multiline editing and keeps its cursor in view. All four themes work, including the light theme. Long model IDs, paths and real streamed output must fit. Opening ASCII shine is finite and reduced-motion aware. The five-row logo has equal-width rows, and menus hide it without replaying the shine. No decorative motion on palette navigation.

## Proof and unresolved decisions
Use actual Ink renders for empty, active, narrow and light-theme captures. Validate keyboard flows and sizes with tests. Model calls may be mocked for visual fixtures; label fixture content accordingly. No new product claims. The user delegated the fourth palette and approved keeping the other three as themes.
