
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "ink-testing-library";

import { ThemeProvider } from "./themes/context.js";
import { THEMES, type ThemeName } from "./themes/themes.js";
import { Select } from "./components/Select.js";
import { Header, tildify, meter } from "./components/Header.js";
import { Editor, paletteQuery, mentionQuery } from "./components/Editor.js";
import { EntryView } from "./components/Messages.js";
import { Help } from "./views/Help.js";
import { Skills } from "./views/Skills.js";
import { Connect } from "./views/Connect.js";
import { renderMarkdown, extractCodeBlocks } from "./markdown.js";
import { filterPalette, resolveCommand } from "./commands.js";
import { rankFiles, fuzzyMatch } from "./components/useFileSuggestions.js";


const KEY = {
  enter: "\r",
  tab: "\t",
  escape: "\x1b",
  down: "\x1b[B",
  up: "\x1b[A",
  ctrlD: "\x04",
};

function wrap(node: React.ReactNode, theme: ThemeName = "carbon") {
  return render(<ThemeProvider name={theme}>{node}</ThemeProvider>);
}

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));


async function press(node: React.ReactNode, keys: string[], theme: ThemeName = "carbon") {
  const app = wrap(node, theme);
  await tick();
  for (const key of keys) {
    app.stdin.write(key);
    await tick();
  }
  return app;
}


function plain(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("paletteQuery", () => {
  it("matches a slash command at the start of the buffer", () => {
    expect(paletteQuery("/hel", 4)).toBe("hel");
    expect(paletteQuery("/", 1)).toBe("");
  });

  it("ignores a slash used mid-sentence", () => {
    // "what does /foo do?" is a question, not a command invocation.
    expect(paletteQuery("what does /foo", 14)).toBeNull();
  });

  it("closes once the command is complete and an argument starts", () => {
    expect(paletteQuery("/new ", 5)).toBeNull();
  });
});

describe("mentionQuery", () => {
  it("matches an @ mention at the cursor", () => {
    expect(mentionQuery("look at @src/app", 16)).toBe("src/app");
    expect(mentionQuery("@", 1)).toBe("");
  });

  it("ignores an @ inside a word, such as an email address", () => {
    expect(mentionQuery("mail me@example.com", 19)).toBeNull();
  });

  it("closes once whitespace follows the mention", () => {
    expect(mentionQuery("@src/app.ts done", 16)).toBeNull();
  });
});

describe("fuzzy file matching", () => {
  it("matches a subsequence", () => {
    expect(fuzzyMatch("src/user/service.ts", "usr")).toBe(true);
    expect(fuzzyMatch("src/user/service.ts", "zzz")).toBe(false);
  });

  it("ranks basename prefix hits first", () => {
    const files = ["src/deep/nested/other.ts", "app.ts", "src/app.ts"];
    expect(rankFiles(files, "app")[0]).toBe("app.ts");
  });
});

describe("commands", () => {
  it("routes /login to connect and /logout to disconnect", () => {
    // Users arriving from Claude Code type these; they must not dead-end.
    expect(resolveCommand("login")?.name).toBe("connect");
    expect(resolveCommand("logout")?.name).toBe("disconnect");
    expect(resolveCommand("model")?.name).toBe("models");
  });

  it("filters the palette by prefix and includes skills", () => {
    const skills = [{ name: "review", description: "Review code", prompt: "p", source: "global" as const }];
    const entries = filterPalette("re", skills);
    expect(entries.some((e) => e.kind === "skill" && e.label === "/review")).toBe(true);
  });

  it("surfaces aliases in the palette description", () => {
    const entry = filterPalette("connect", [])[0];
    expect(entry?.description).toContain("/login");
  });

  it("routes /themes and /clear through their aliases", () => {
    expect(resolveCommand("themes")?.name).toBe("theme");
    expect(resolveCommand("clear")?.name).toBe("new");
  });

  it("finds a command by substring, ranking prefix matches first", () => {
    const entries = filterPalette("act", []);
    expect(entries.some((e) => e.kind === "command" && e.name === "compact")).toBe(true);

    const themed = filterPalette("th", []);
    expect(themed[0]).toMatchObject({ kind: "command", name: "theme" });
  });

  it("lists every command for a bare slash", () => {
    const entries = filterPalette("", []);
    expect(entries.filter((e) => e.kind === "command")).toHaveLength(12);
  });
});

describe("markdown", () => {
  it("renders headings and code without throwing", () => {
    const out = renderMarkdown("# Title\n\n`code`\n", THEMES.carbon);
    expect(plain(out)).toContain("Title");
  });

  it("falls back to raw text on malformed input rather than crashing", () => {
    const out = renderMarkdown("```unclosed\nstuff", THEMES.carbon);
    expect(out).toBeTruthy();
  });

  it("extracts fenced code blocks", () => {
    const blocks = extractCodeBlocks("text\n```ts\nconst a = 1;\n```\nmore");
    expect(blocks).toEqual([{ lang: "ts", code: "const a = 1;\n" }]);
  });
});

describe("Select", () => {
  it("renders items and marks the first active", () => {
    const { lastFrame } = wrap(
      <Select
        title="Pick"
        items={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
        onSelect={() => {}}
        onCancel={() => {}}
      />,
    );
    const out = plain(lastFrame() ?? "");
    expect(out).toContain("Pick");
    expect(out).toContain("Alpha");
    expect(out).toContain("Beta");
    expect(out).toContain("❯");
  });

  it("renders an empty list without crashing", () => {
    const { lastFrame } = wrap(
      <Select title="Empty" items={[]} onSelect={() => {}} onCancel={() => {}} emptyMessage="None found." />,
    );
    expect(plain(lastFrame() ?? "")).toContain("None found.");
  });

  it("selects on enter", async () => {
    const onSelect = vi.fn();
    await press(
      <Select title="Pick" items={[{ value: "a", label: "Alpha" }]} onSelect={onSelect} onCancel={() => {}} />,
      [KEY.enter],
    );
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("moves the highlight with the down arrow", async () => {
    const onSelect = vi.fn();
    await press(
      <Select
        title="Pick"
        items={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
        onSelect={onSelect}
        onCancel={() => {}}
      />,
      [KEY.down, KEY.enter],
    );
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("cancels on escape", async () => {
    const onCancel = vi.fn();
    await press(
      <Select title="Pick" items={[{ value: "a", label: "Alpha" }]} onSelect={() => {}} onCancel={onCancel} />,
      [KEY.escape],
    );
    expect(onCancel).toHaveBeenCalled();
  });

  it("fires onDelete for Ctrl+D, which is how sessions are removed", async () => {
    const onDelete = vi.fn();
    await press(
      <Select
        title="Pick"
        items={[{ value: "a", label: "Alpha" }]}
        onSelect={() => {}}
        onCancel={() => {}}
        onDelete={onDelete}
      />,
      [KEY.ctrlD],
    );
    expect(onDelete).toHaveBeenCalledWith("a");
  });

  it("filters items as you type", async () => {
    const app = await press(
      <Select
        title="Pick"
        items={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
        onSelect={() => {}}
        onCancel={() => {}}
      />,
      ["bet"],
    );
    const out = plain(app.lastFrame() ?? "");
    expect(out).toContain("Beta");
    expect(out).not.toContain("Alpha");
  });

  it("selects the filtered match, not the original first item", async () => {
    const onSelect = vi.fn();
    await press(
      <Select
        title="Pick"
        items={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
        onSelect={onSelect}
        onCancel={() => {}}
      />,
      ["bet", KEY.enter],
    );
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("escape clears the query before it cancels", async () => {
    const onCancel = vi.fn();
    const app = await press(
      <Select
        title="Pick"
        items={[{ value: "a", label: "Alpha" }]}
        onSelect={() => {}}
        onCancel={onCancel}
      />,
      ["alp", KEY.escape],
    );
    expect(onCancel).not.toHaveBeenCalled();
    expect(plain(app.lastFrame() ?? "")).toContain("Alpha");

    app.stdin.write(KEY.escape);
    await tick();
    expect(onCancel).toHaveBeenCalled();
  });

  it("previews on highlight, which is what makes /theme live", async () => {
    const onHighlight = vi.fn();
    await press(
      <Select
        title="Pick"
        items={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
        onSelect={() => {}}
        onCancel={() => {}}
        onHighlight={onHighlight}
      />,
      [KEY.down],
    );
    expect(onHighlight).toHaveBeenCalledWith("b");
  });
});

describe("Header", () => {
  it("shows the cwd, mode, and model", () => {
    const { lastFrame } = wrap(<Header cwd="/tmp/proj" mode="build" model="gpt-4o" provider="OpenAI" />);
    const out = plain(lastFrame() ?? "");
    expect(out).toContain("proj");
    expect(out).toContain("BUILD");
    expect(out).toContain("gpt-4o");
  });

  it("shows plan when in plan mode", () => {
    const { lastFrame } = wrap(<Header cwd="/tmp/proj" mode="plan" />);
    expect(plain(lastFrame() ?? "")).toContain("PLAN");
  });

  it("shows the context percentage", () => {
    const { lastFrame } = wrap(<Header cwd="/tmp/p" mode="build" tokens={50} contextLimit={100} />);
    expect(plain(lastFrame() ?? "")).toContain("50%");
  });
});

describe("tildify", () => {
  it("collapses the home directory to a tilde", () => {
    const home = require("node:os").homedir();
    expect(tildify(home)).toBe("~");
    expect(tildify(require("node:path").join(home, "code", "app"))).toBe("~/code/app");
  });

  it("leaves a path outside home alone", () => {
    const out = tildify("/var/tmp/x");
    expect(out).toContain("var");
  });
});

describe("meter", () => {
  it("fills proportionally and clamps", () => {
    expect(meter(0, 5)).toBe("▱▱▱▱▱");
    expect(meter(1, 5)).toBe("▰▰▰▰▰");
    expect(meter(0.4, 5)).toBe("▰▰▱▱▱");
    expect(meter(5, 5)).toBe("▰▰▰▰▰");
    expect(meter(-1, 5)).toBe("▱▱▱▱▱");
  });
});

describe("Editor", () => {
  const base = {
    mode: "build" as const,
    cwd: process.cwd(),
    skills: [],
    busy: false,
    onSubmit: vi.fn(),
    onPalette: vi.fn(),
    onToggleMode: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it("shows a placeholder when empty", () => {
    const { lastFrame } = wrap(<Editor {...base} />);
    expect(plain(lastFrame() ?? "")).toContain("Type a command");
  });

  it("shows the plan-mode placeholder in plan mode", () => {
    const { lastFrame } = wrap(<Editor {...base} mode="plan" />);
    expect(plain(lastFrame() ?? "")).toContain("Ask what would change");
  });

  it("echoes typed text and submits on enter", async () => {
    const onSubmit = vi.fn();
    const { lastFrame } = await press(<Editor {...base} onSubmit={onSubmit} />, ["hello"]);
    expect(plain(lastFrame() ?? "")).toContain("hello");

    await press(<Editor {...base} onSubmit={onSubmit} />, ["hello", KEY.enter]);
    expect(onSubmit).toHaveBeenCalledWith("hello");
  });

  it("toggles mode on tab when no picker is open", async () => {
    const onToggleMode = vi.fn();
    await press(<Editor {...base} onToggleMode={onToggleMode} />, [KEY.tab]);
    expect(onToggleMode).toHaveBeenCalled();
  });

  it("opens the palette on a leading slash", async () => {
    const { lastFrame } = await press(<Editor {...base} />, ["/th"]);
    expect(plain(lastFrame() ?? "")).toContain("/theme");
  });

  it("invokes a command from the palette on enter", async () => {
    const onPalette = vi.fn();
    await press(<Editor {...base} onPalette={onPalette} />, ["/help", KEY.enter]);
    expect(onPalette).toHaveBeenCalledWith(expect.objectContaining({ kind: "command", name: "help" }));
  });

  it("does not treat a mid-sentence slash as a command", async () => {
    const onSubmit = vi.fn();
    const onPalette = vi.fn();
    await press(<Editor {...base} onSubmit={onSubmit} onPalette={onPalette} />, ["what is /help", KEY.enter]);
    expect(onPalette).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledWith("what is /help");
  });

  it("ignores input while busy, so keystrokes cannot queue mid-response", async () => {
    const onSubmit = vi.fn();
    const { lastFrame } = await press(<Editor {...base} busy onSubmit={onSubmit} />, ["hello", KEY.enter]);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(plain(lastFrame() ?? "")).not.toContain("hello");
  });

  it("does not submit an empty buffer", async () => {
    const onSubmit = vi.fn();
    await press(<Editor {...base} onSubmit={onSubmit} />, ["   ", KEY.enter]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("inserts a newline on ctrl+J rather than submitting", async () => {
    // The portable fallback for terminals that cannot report Shift+Enter.
    const onSubmit = vi.fn();
    const { lastFrame } = await press(<Editor {...base} onSubmit={onSubmit} />, ["a", "\n", "b"]);
    expect(onSubmit).not.toHaveBeenCalled();
    const out = plain(lastFrame() ?? "");
    expect(out).toContain("a");
    expect(out).toContain("b");
  });
});

describe("EntryView", () => {
  it("renders each entry kind without throwing", () => {
    const entries = [
      { kind: "user", text: "hi" },
      { kind: "assistant", text: "# Answer\n\nbody" },
      { kind: "thinking", text: "hmm", seconds: 3 },
      { kind: "tool", name: "read", preview: "Read a.ts", result: "line one\nline two", isError: false },
      { kind: "compaction", summarized: 8, before: 40000, after: 9000 },
      { kind: "notice", text: "done", tone: "success" },
    ] as const;

    for (const entry of entries) {
      const { lastFrame } = wrap(<EntryView entry={entry} />);
      expect(lastFrame()).toBeDefined();
    }
  });

  it("collapses a thinking block to a duration line", () => {
    const { lastFrame } = wrap(<EntryView entry={{ kind: "thinking", text: "reasoning", seconds: 4 }} />);
    const out = plain(lastFrame() ?? "");
    expect(out).toContain("Thought for 4s");
    expect(out).not.toContain("reasoning");
  });

  it("marks a failed tool call distinctly", () => {
    const { lastFrame } = wrap(
      <EntryView entry={{ kind: "tool", name: "bash", preview: "npm test", result: "boom", isError: true }} />,
    );
    expect(plain(lastFrame() ?? "")).toContain("✗ failed");
  });

  it("reports what compaction did, with the heading on one line", () => {
    const { lastFrame } = wrap(
      <EntryView entry={{ kind: "compaction", summarized: 14, before: 48300, after: 9100 }} />,
    );
    const out = plain(lastFrame() ?? "");
    // The heading sits next to a rule that flexes to fill the row. If the
    // heading is ever allowed to shrink, yoga wraps it mid-phrase instead.
    expect(out).toContain("⟩⟨ CONTEXT COMPACTED ─");
    expect(out).toContain("14 messages summarized");
    expect(out).toContain("~48,300 → ~9,100 tokens");
    expect(out).toContain("−81%");
  });

  it("leaves the saving off a compaction that saved nothing", () => {
    const { lastFrame } = wrap(<EntryView entry={{ kind: "compaction", summarized: 1, before: 5000, after: 5000 }} />);
    const out = plain(lastFrame() ?? "");
    expect(out).toContain("1 message summarized");
    expect(out).not.toContain("−0%");
  });
});

describe("views", () => {
  it("Help lists commands and shortcuts", () => {
    const { lastFrame } = wrap(<Help onClose={() => {}} />);
    const out = plain(lastFrame() ?? "");
    expect(out).toContain("/connect");
    expect(out).toContain("toggle build / plan");
  });

  it("Skills pins the create and import actions even when empty", () => {
    const { lastFrame } = wrap(
      <Skills skills={[]} errors={[]} cwd={process.cwd()} onClose={() => {}} onChanged={() => {}} />,
    );
    const out = plain(lastFrame() ?? "");
    expect(out).toContain("New skill");
    expect(out).toContain("Import JSON");
  });

  it("Skills reports invalid entries instead of hiding them", () => {
    const { lastFrame } = wrap(
      <Skills
        skills={[]}
        errors={["skills.json[0]: bad"]}
        cwd={process.cwd()}
        onClose={() => {}}
        onChanged={() => {}}
      />,
    );
    expect(plain(lastFrame() ?? "")).toContain("Skipped 1 invalid entry");
  });
});

describe("Connect walkthrough", () => {
  it("clears the field between steps", async () => {
    // React keeps the mounted <TextPrompt> when the same component renders in
    // the same tree position across steps, so its `value` state survives into
    // the next step: the base URL reappears in the name field, and the name
    // shows up masked in the API key field. Each step must remount.
    const app = wrap(<Connect onDone={() => {}} onCancel={() => {}} />);
    await tick();

    // Down to "Other", enter -> the base URL step. One key per write: a batched
    // write is parsed as a single keypress, not a sequence.
    for (let i = 0; i < 6; i++) {
      app.stdin.write(KEY.down);
      await tick();
    }
    app.stdin.write(KEY.enter);
    await tick();
    expect(plain(app.lastFrame() ?? "")).toContain("Base URL");

    app.stdin.write("https://api.example.com/v1");
    await tick();
    app.stdin.write(KEY.enter);
    await tick();

    // The name step must start empty, not holding the URL.
    const nameStep = plain(app.lastFrame() ?? "");
    expect(nameStep).toContain("Name this provider");
    expect(nameStep).not.toContain("api.example.com");

    app.stdin.write("mine");
    await tick();
    app.stdin.write(KEY.enter);
    await tick();

    // The key step must start empty too — no carried-over dots.
    const keyStep = plain(app.lastFrame() ?? "");
    expect(keyStep).toContain("API key for mine");
    expect(keyStep).not.toContain("•");
  });

  it("rejects an empty base URL rather than advancing", async () => {
    const app = wrap(<Connect onDone={() => {}} onCancel={() => {}} />);
    await tick();
    for (let i = 0; i < 6; i++) {
      app.stdin.write(KEY.down);
      await tick();
    }
    app.stdin.write(KEY.enter);
    await tick();
    app.stdin.write(KEY.enter);
    await tick();
    expect(plain(app.lastFrame() ?? "")).toContain("A base URL is required.");
  });
});

describe("panel height", () => {
  // Ink erases a frame by moving the cursor up by its height. A frame taller
  // than the terminal cannot be erased, so the next one draws below the
  // remains — which looks like the panel duplicating on every keypress. Any
  // always-visible panel has to stay well inside a standard 24-row terminal.
  const MAX_ROWS = 20;

  function heightOf(frame: string | undefined): number {
    return (frame ?? "").split("\n").length;
  }

  it("keeps the provider list short enough for Ink to erase", async () => {
    const app = wrap(<Connect onDone={() => {}} onCancel={() => {}} />);
    await tick();
    expect(heightOf(app.lastFrame())).toBeLessThanOrEqual(MAX_ROWS);
  });

  it("does not grow as the selection moves", async () => {
    const app = wrap(<Connect onDone={() => {}} onCancel={() => {}} />);
    await tick();
    const before = heightOf(app.lastFrame());

    for (let i = 0; i < 4; i++) {
      app.stdin.write(KEY.down);
      await tick();
    }
    expect(heightOf(app.lastFrame())).toBe(before);
  });

  it("windows a long list instead of rendering every item", async () => {
    const items = Array.from({ length: 200 }, (_, i) => ({ value: String(i), label: `item-${i}` }));
    const { lastFrame } = wrap(<Select title="Many" items={items} onSelect={() => {}} onCancel={() => {}} />);
    expect(heightOf(lastFrame())).toBeLessThanOrEqual(MAX_ROWS);
  });

  it("shows the item count and a more-below marker once windowed", () => {
    const items = Array.from({ length: 200 }, (_, i) => ({ value: String(i), label: `item-${i}` }));
    const { lastFrame } = wrap(<Select title="Many" items={items} onSelect={() => {}} onCancel={() => {}} />);
    const out = plain(lastFrame() ?? "");
    expect(out).toContain("200");
    expect(out).toContain("more");
  });

  it("keeps the editor with an open palette short", async () => {
    const app = wrap(
      <Editor
        mode="build"
        cwd={process.cwd()}
        skills={[]}
        busy={false}
        onSubmit={() => {}}
        onPalette={() => {}}
        onToggleMode={() => {}}
      />,
    );
    await tick();
    app.stdin.write("/");
    await tick();
    expect(heightOf(app.lastFrame())).toBeLessThanOrEqual(MAX_ROWS);
  });
});

describe("Editor input clearing", () => {
  it("empties the field after submitting", async () => {
    const app = wrap(
      <Editor
        mode="build"
        cwd={process.cwd()}
        skills={[]}
        busy={false}
        onSubmit={() => {}}
        onPalette={() => {}}
        onToggleMode={() => {}}
      />,
    );
    await tick();
    app.stdin.write("hello world");
    await tick();
    expect(plain(app.lastFrame() ?? "")).toContain("hello world");

    app.stdin.write(KEY.enter);
    await tick();
    const after = plain(app.lastFrame() ?? "");
    expect(after).not.toContain("hello world");
    expect(after).toContain("Type a command");
  });

  it("clears the field on escape", async () => {
    const app = wrap(
      <Editor
        mode="build"
        cwd={process.cwd()}
        skills={[]}
        busy={false}
        onSubmit={() => {}}
        onPalette={() => {}}
        onToggleMode={() => {}}
      />,
    );
    await tick();
    app.stdin.write("draft text");
    await tick();
    app.stdin.write(KEY.escape);
    await tick();
    expect(plain(app.lastFrame() ?? "")).not.toContain("draft text");
  });
});

describe("every theme renders", () => {
  it.each(Object.keys(THEMES) as ThemeName[])("%s", (name) => {
    const { lastFrame } = wrap(<Header cwd="/tmp/p" mode="build" model="m" />, name);
    expect(plain(lastFrame() ?? "")).toContain("BUILD");
  });
});
